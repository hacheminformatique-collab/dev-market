import { DEPARTMENTS, getCityBySlug } from '../data/idf-cities'
import './WeddingDirectory.css'
import { normalizeCityName } from '../utils/cityNames'

export default function WeddingDirectory({ slugs, businessName = 'Le Paradise' }) {
  // Resolve each URL exactly as CityPage does, including legacy duplicate slugs.
  const published = [...new Set(slugs)].map(getCityBySlug).filter(Boolean)
  const departments = DEPARTMENTS.map((department) => ({
    ...department,
    cities: published.filter((city) => city.deptCode === department.code)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  })).filter((department) => department.cities.length > 0)
  if (departments.length === 0) return null

  return (
    <section className="wedding-directory" aria-labelledby="wedding-directory-heading">
      <h2 id="wedding-directory-heading">Zone de location de salle de mariage</h2>
      <p>
        Un seul lieu de réception : {businessName}, au 5 avenue Fridingen,
        77100 Nanteuil les Meaux. Retrouvez les pages de location de salle de mariage
        pour organiser votre réception depuis votre commune.
      </p>
      <div className="wedding-directory-departments">
        {departments.map((department) => (
          <div key={department.code} className="wedding-directory-department">
            <h3>{`${department.name} (${department.code})`}</h3>
            <ul>
              {department.cities.map((city) => {
                const label = `Location salle de mariage ${normalizeCityName(city.name)}`
                return (
                  <li key={city.slug}>
                    <a href={`/locationsalledemariage/${city.slug}`} title={label}>{label}</a>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
