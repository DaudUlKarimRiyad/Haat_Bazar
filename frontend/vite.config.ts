import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: "antd-icons",
              test: /node_modules[\\/]@ant-design[\\/](icons|icons-svg)[\\/]/,
              priority: 25,
            },
            {
              name: "rc-vendor",
              test: /node_modules[\\/]@rc-component[\\/]/,
              priority: 20,
            },
            {
              name: "antd-vendor",
              test: /node_modules[\\/](antd|@ant-design|dayjs)[\\/]/,
              priority: 15,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
})
