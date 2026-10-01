export const COPIED_MS = 2000;

/**
 * "Copié" for two seconds after `action` resolves. A rejected action (clipboard refused)
 * leaves `copied` false, so the screen never claims a copy that did not happen.
 */
export function copiedFeedback() {
  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  return {
    get copied(): boolean {
      return copied;
    },
    async run(action: () => Promise<void>): Promise<void> {
      try {
        await action();
      } catch {
        return;
      }
      copied = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        copied = false;
      }, COPIED_MS);
    },
    dispose(): void {
      clearTimeout(timer);
    },
  };
}
