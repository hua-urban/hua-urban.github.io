// A cat faces local +Z. Keep route time separate from time spent turning/resting.
const TURN_RATE = 2.8;
const FACING_TOLERANCE = 5 * Math.PI / 180;
const EPSILON = 1e-10;

const angleDifference = (target, current) =>
  Math.atan2(Math.sin(target - current), Math.cos(target - current));

export function createCatWalker({ root, routes, speed, idle = 0, startProgress = 0 }) {
  if (!root || !Array.isArray(routes) || routes.length === 0) {
    throw new TypeError('A cat walker needs a root and at least one route.');
  }
  const lengths = routes.map(({ path }) => path.getLength());
  const restDuration = Number.isFinite(idle) ? Math.max(0, idle) : 0;
  let routeIndex = 0;
  let progress = Number.isFinite(startProgress)
    ? Math.max(0, Math.min(1, startProgress)) : 0;
  let distance = lengths[0] * progress;
  let idleTime = 0;
  let resting = progress === 1;

  const positionAt = (index, at) => routes[index].path.getPointAt(at);
  const place = point => root.position.set(point.x, point.y, point.z);
  const initialPoint = positionAt(0, progress);
  place(initialPoint);
  // Use a forward chord for the initial heading, including at a curve's endpoint.
  const sampleProgress = progress < 1 ? Math.min(1, progress + 0.0001) : Math.max(0, progress - 0.0001);
  const sample = positionAt(0, sampleProgress);
  const direction = progress < 1 ? 1 : -1;
  let yaw = Math.atan2((sample.x - initialPoint.x) * direction,
    (sample.z - initialPoint.z) * direction);
  root.rotation.set(0, yaw, 0);

  let state = { walking: false, turning: false, routeIndex, progress,
    idleTime: 0, distance, travelled: 0 };
  function report(walking, turning, travelled = 0) {
    state = { walking, turning, routeIndex, progress, idleTime, distance, travelled };
    return { ...state };
  }

  return {
    update(dt = 0) {
      if (!Number.isFinite(dt) || dt <= 0) return { ...state };
      dt = Math.min(dt, 0.1);
      root.rotation.set(0, yaw, 0);
      if (resting) {
        if (idleTime < restDuration) {
          idleTime = Math.min(restDuration, idleTime + dt);
          return report(false, false);
        }
        routeIndex = (routeIndex + 1) % routes.length;
        progress = 0;
        distance = 0;
        idleTime = 0;
        resting = false;
        // Connected routes share their endpoint. Preserve the actual position;
        // never snap to the next path's start when changing routes.
      }

      const length = lengths[routeIndex];
      const configuredSpeed = Number.isFinite(speed) ? Math.max(0, speed)
        : (routes[routeIndex].duration > 0 ? length / routes[routeIndex].duration : 0);
      if (!(length > EPSILON) || !(configuredSpeed > 0)) {
        return report(false, false);
      }
      const nextDistance = Math.min(length, distance + configuredSpeed * dt);
      const nextProgress = nextDistance / length;
      const next = positionAt(routeIndex, nextProgress);
      const dx = next.x - root.position.x;
      const dy = next.y - root.position.y;
      const dz = next.z - root.position.z;
      const travelled = Math.hypot(dx, dy, dz);
      if (Math.hypot(dx, dz) > EPSILON) {
        const desiredYaw = Math.atan2(dx, dz);
        const difference = angleDifference(desiredYaw, yaw);
        const turn = Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, difference));
        yaw = Math.atan2(Math.sin(yaw + turn), Math.cos(yaw + turn));
        root.rotation.set(0, yaw, 0);
        if (Math.abs(angleDifference(desiredYaw, yaw)) > FACING_TOLERANCE) {
          return report(false, true);
        }
      }
      place(next);
      distance = nextDistance;
      progress = nextProgress;
      if (distance >= length) {
        progress = 1;
        resting = true;
        idleTime = 0;
      }
      return report(travelled > EPSILON, false, travelled);
    }
  };
}
