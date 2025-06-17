import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {}

// Create electronAPI manually for better compatibility
const electronAPI = {
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, func: (...args: any[]) => void) => {
      const subscription = (_event: any, ...args: any[]) => func(...args)
      ipcRenderer.on(channel, subscription)
      return () => ipcRenderer.removeListener(channel, subscription)
    },
    once: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.once(channel, (_event, ...args) => func(...args))
    },
    removeAllListeners: (channel: string) => {
      ipcRenderer.removeAllListeners(channel)
    }
  },
  openHighliteWindow: (url: string) => ipcRenderer.invoke('open-highlite-window', url)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
