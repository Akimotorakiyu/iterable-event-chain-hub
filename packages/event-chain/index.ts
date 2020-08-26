export type CallBack<Args extends unknown[], V = unknown> = (
  ...args: Args
) => V;
export type CallBackSet = Set<CallBack<unknown[]>>;

/**
 *
 *
 * @export
 * @class EventLite
 */
export class EventLite {
  constructor() {}
  doMap = new Map<unknown, CallBackSet>();
  doOnceMap = new Map<unknown, CallBackSet>();

  /**
   *
   *
   * @template E typeof event key
   * @param {E} event event key
   * @returns typed handler
   * @memberof EventLite
   */
  event<E>(this: EventLite, event: E) {
    return <Args extends unknown[]>() => {
      return this.typed<Args, E>(event);
    };
  }

  /**
   *
   *
   * @template Args typeof args for callback
   * @template E typeof event key
   * @param {E} event event key
   * @param {CallBack<Args>} fn callback
   * @returns
   * @memberof EventLite
   */
  on<Args extends unknown[], E>(this: EventLite, event: E, fn: CallBack<Args>) {
    const map = this.doMap;
    let callBackSet: CallBackSet;

    if (!(callBackSet = map.get(event))) {
      map.set(event, (callBackSet = new Set()));
    }
    callBackSet.add(fn);

    return this.typed<Args, E>(event);
  }

  /**
   *
   *
   * @template Args typeof args for callback
   * @template E  typeof event key
   * @param {E} event event key
   * @param {CallBack<Args>} fn callback
   * @returns
   * @memberof EventLite
   */
  once<Args extends unknown[], E>(
    this: EventLite,
    event: E,
    fn: CallBack<Args>
  ) {
    const map = this.doOnceMap;
    let callBackSet: CallBackSet;

    if (!(callBackSet = map.get(event))) {
      map.set(event, (callBackSet = new Set()));
    }

    callBackSet.add(fn);
    return this.typed<Args, E>(event);
  }

  /**
   *
   *
   * @template Args typeof args for callback
   * @template E typeof event key
   * @param {E} event event key
   * @returns
   * @memberof EventLite
   */
  typed<Args extends unknown[], E = unknown>(this: EventLite, event: E) {
    const make = {
      event,
      async *iterable<R>() {
        let resolverPool: [
          (args: { cancel: (reason: R) => void; data: Args }) => void,
          (reason: R) => void
        ][] = [];
        const pool: Args[] = [];

        function recive(...args: Args) {
          pool.push(args);
          deal();
        }

        make.typedOn(recive);

        let status = true;
        const cancel = (reason: R) => {
          status = false;
          make.typedRemove(recive);
          deal();

          resolverPool.forEach(([resolve, reject]) => {
            reject(reason);
          });

          resolverPool.length = 0;
          pool.length = 0;
        };

        const deal = () => {
          while (resolverPool.length && pool.length) {
            const [resolve] = resolverPool.shift();
            const args = pool.shift();
            resolve({
              data: args,
              cancel,
            });
          }
        };

        while (status) {
          yield new Promise<{ cancel: (reason: R) => void; data: Args }>(
            (rsolve, reject) => {
              resolverPool.push([rsolve, reject]);
              deal();
            }
          );
        }
      },
      typedOn: (fn: CallBack<Args>) => {
        this.on(event, fn);
        return make;
      },
      typedOnce: (fn: CallBack<Args>) => {
        this.once(event, fn);
        return make;
      },
      typedRemove: (fn: CallBack<Args> | undefined) => {
        this.remove(event, fn);
        return make;
      },
      eventLite: this,
      typedEmit: (...args: Args) => {
        this.emit(event, ...args);
        return make;
      },
      typedPipe: <V, E>(fn: CallBack<Args, V>, follow?: E) => {
        const pipeMake = this.typed<[V]>(follow ?? Symbol());

        make.typedOn((...args) => {
          const value = fn(...args);
          pipeMake.typedEmit(value);
        });

        return pipeMake;
      },
      typedConnect: () => {
        return this.connect<Args, E>(event);
      },
    };
    return make;
  }

  /**
   *
   *
   * @template Args typeof args for callback
   * @template E typeof event key
   * @param {E} event event key
   * @param {...Args} args args
   * @returns
   * @memberof EventLite
   */
  emit<Args extends unknown[], E>(this: EventLite, event: E, ...args: Args) {
    this.doMap.get(event)?.forEach((fn) => {
      fn(...args);
    });

    this.doOnceMap.get(event)?.forEach((fn) => {
      fn(...args);
    });

    this.doOnceMap.delete(event);

    return this.typed<Args, E>(event);
  }

  /**
   *
   *
   * @template Args typeof args for callback
   * @template E typeof event key
   * @param {(E | undefined)} event event key
   * @param {(CallBack<Args> | undefined)} fn callback
   * @returns current EventLite instance
   * @memberof EventLite
   */
  remove<Args extends unknown[], E>(
    this: EventLite,
    event: E | undefined,
    fn: CallBack<Args> | undefined
  ) {
    if (event && fn) {
      this.doMap.get(event)?.delete(fn);
      this.doOnceMap.get(event)?.delete(fn);
    } else if (fn) {
      this.doMap.forEach((set) => {
        set.delete(fn);
      });
      this.doOnceMap.forEach((set) => {
        set.delete(fn);
      });
    } else if (event) {
      this.doMap.delete(event);
      this.doOnceMap.delete(event);
    }

    return this;
  }

  connect<Args extends unknown[], E = unknown>(
    this: EventLite,
    event: E,
    eventLite = new EventLite()
  ) {
    const connectionPoint = eventLite.typed<Args, E>(event);

    this.typed<Args, E>(event).typedOn((...args) => {
      connectionPoint.typedEmit(...args);
    });

    return connectionPoint;
  }
}
