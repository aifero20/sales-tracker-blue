export function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        console.log("SW registered:", reg.scope);
      }).catch((err) => {
        console.warn("SW registration failed:", err);
      });

      // Auto-reload saat SW baru aktif (ada update deploy)
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "SW_UPDATED") {
          window.location.reload();
        }
      });
    });
  }
}
