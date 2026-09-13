export function usePathname() {
  return "/";
}

export function useRouter() {
  return {
    push: () => undefined,
    replace: () => undefined,
    prefetch: () => undefined,
  };
}
