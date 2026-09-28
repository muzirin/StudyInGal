import { Alert, Snackbar } from '@mui/material'
import { useAppStore } from '../state/appStore'

export function Toaster() {
  const toasts = useAppStore((state) => state.toasts)
  const dismiss = useAppStore((state) => state.dismissToast)

  return (
    <>
      {toasts.slice(0, 4).map((toast, index) => (
        <Snackbar
          key={toast.id}
          open
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          sx={{ mb: `${index * 56}px` }}
          onClose={() => dismiss(toast.id)}
        >
          <Alert severity={toast.severity} variant="filled" onClose={() => dismiss(toast.id)} sx={{ maxWidth: 520 }}>
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  )
}
