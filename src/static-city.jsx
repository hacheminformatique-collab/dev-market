import { hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CityPageContent } from './components/VillesPages/CityPage'
import DepartmentPage from './components/VillesPages/DepartmentPage'
import PageAnalytics from './components/PageAnalytics'
import './index.css'
import './components/WeddingDirectory.css'

const snapshot = document.getElementById('city-page-data')
if (snapshot) {
  const data = JSON.parse(snapshot.textContent)
  hydrateRoot(document.getElementById('root'), (
      <BrowserRouter>
        <PageAnalytics />
        {data.departmentCode ? <DepartmentPage {...data} /> : <CityPageContent {...data} published />}
      </BrowserRouter>
  ))
}
