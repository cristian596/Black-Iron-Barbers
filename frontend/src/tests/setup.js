import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// jsdom no implementa window.scrollTo y avisa "Not implemented" en cada llamada (p. ej. ScrollToTop dentro de AppRouter).
if (typeof window !== 'undefined') window.scrollTo = vi.fn()
