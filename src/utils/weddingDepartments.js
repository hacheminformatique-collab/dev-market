import { DEPARTMENTS } from '../data/idf-cities'

export const WEDDING_DEPARTMENTS = DEPARTMENTS.filter(({ code }) =>
  ['75', '77', '78', '91', '92', '93', '94', '95', '02', '27', '28', '45', '51', '60', '76', '89'].includes(code))

export const departmentPath = (code) => `/locationsalledemariage/departements/${code}`

export function directoryDepartmentCode(city) {
  const department = WEDDING_DEPARTMENTS.find(({ code }) => code === city?.deptCode)
  return department && department.region !== 'Île-de-France' ? department.code : undefined
}
