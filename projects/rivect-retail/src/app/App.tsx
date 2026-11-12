import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from '@/app/providers/AppProviders'
import { AppRouter } from '@/app/router'

// En el portal se sirve bajo /retail/ (BASE_URL); en local, en la raíz.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </BrowserRouter>
  )
}
