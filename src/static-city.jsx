import { hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CityPageContent } from './components/VillesPages/CityPage'
import { initStorage } from './utils/storage'
import './index.css'

const snapshot = document.getElementById('city-page-data')
if (snapshot) {
  const data = JSON.parse(snapshot.textContent)
  initStorage().then(() => {
    hydrateRoot(document.getElementById('root'), (
      <BrowserRouter>
        <CityPageContent {...data} published />
      </BrowserRouter>
    ))
  })
}
