export const sleep = (durationInMs: number) => {
  return new Promise((resolve) => { setTimeout(resolve, durationInMs) });
}
