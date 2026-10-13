import { Checkbox, Form } from 'antd'

// Sits under a `positionIds` multi-select: each picked position gets its own required set
// of type checkboxes (Internship / FTE / Intern-to-FTE), stored as positionTypes[positionId].
export default function PositionTypeFields({ positions, positionTypes }) {
  return (
    <Form.Item noStyle dependencies={['positionIds']}>
      {({ getFieldValue }) => (getFieldValue('positionIds') ?? []).map((id) => (
        <Form.Item
          key={id}
          name={['positionTypes', String(id)]}
          label={`${positions?.find((p) => p.id === id)?.title ?? 'Position'} — hiring as`}
          rules={[{ required: true, type: 'array', min: 1, message: 'Choose at least one type' }]}
        >
          <Checkbox.Group options={(positionTypes ?? []).map((t) => ({ value: t.id, label: t.name }))} />
        </Form.Item>
      ))}
    </Form.Item>
  )
}

// Form values -> the [{ positionId, typeIds }] body the event endpoints take.
export const toEventPositions = ({ positionIds = [], positionTypes = {} }) =>
  positionIds.map((id) => ({ positionId: id, typeIds: positionTypes[String(id)] ?? [] }))
