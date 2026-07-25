import CalendarView from '../../CalendarView'
import { getClients } from '../../../utils/storage'

export default function CalendarTab() {
  const clients = getClients()
  const events = clients.map((c) => ({
    date: c.dateEvenement || '',
    label: `${c.prenom || ''} ${c.nom || ''} – ${c.typeEvenement || ''}`,
    type: c.typeEvenement || '',
  }))

  return (
    <div>
      <CalendarView events={events} />
    </div>
  )
}
