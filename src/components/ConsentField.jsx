import { Checkbox, Form } from 'antd'

// Required on every form where a candidate hands over their data; the backend rejects a submission without it.
export default function ConsentField({ label = 'I agree that J&J Sourcing may store and use the information I provide for recruitment purposes.' }) {
  return (
    <Form.Item
      name="consent"
      valuePropName="checked"
      rules={[{ validator: (_, checked) => (checked ? Promise.resolve() : Promise.reject(new Error('Please agree to continue'))) }]}
    >
      <Checkbox>{label}</Checkbox>
    </Form.Item>
  )
}
