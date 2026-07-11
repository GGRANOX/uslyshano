import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Разрешаем доступ к dev-серверу по локальному IP (проверка на
  // телефоне/другом устройстве в той же Wi-Fi сети) — без этого Next.js
  // блокирует cross-origin запросы к _next-ресурсам, React не гидрируется,
  // и все интерактивные элементы (счётчик символов, кнопки) не работают.
  allowedDevOrigins: ["192.168.0.225", "192.168.0.82"],
};

export default nextConfig;
