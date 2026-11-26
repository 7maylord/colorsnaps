"use client";

import { Toaster } from "sonner";

export default function ToastHost() {
  return <Toaster position="top-right" theme="dark" richColors closeButton expand visibleToasts={5} toastOptions={{ className: "colorsnap-toast" }} />;
}
