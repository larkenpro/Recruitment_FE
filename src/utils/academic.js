import dayjs from 'dayjs'

const NUMBER_FIELDS = ['graduationYear', 'tenthMark', 'twelfthMark', 'diplomaMark', 'keamRank', 'ugCgpa', 'pgCgpa', 'arrears', 'backlogs']
const COUNT_FIELDS = ['arrears', 'backlogs']

export const formatAvailability = ([start, end] = []) =>
  start && end ? `${start.format('MMMM-YYYY')} to ${end.format('MMMM-YYYY')}` : null

export const parseAvailability = (text) => {
  const parts = text?.split(' to ')
  return parts?.length === 2 ? [dayjs(parts[0], 'MMMM-YYYY'), dayjs(parts[1], 'MMMM-YYYY')] : null
}

// Form values -> API body. <Input type="number"> yields strings, and an empty backlog count means none.
export const academicPayload = (values) => ({
  ...values,
  ...Object.fromEntries(NUMBER_FIELDS.map((field) => {
    const raw = values[field]
    const empty = raw === undefined || raw === null || raw === ''
    return [field, empty ? (COUNT_FIELDS.includes(field) ? 0 : null) : Number(raw)]
  })),
  internshipAvailability: formatAvailability(values.internshipAvailability ?? []),
})

// API details -> form values.
export const academicFormValues = (details) => ({
  ...details,
  internshipAvailability: parseAvailability(details?.internshipAvailability),
})
