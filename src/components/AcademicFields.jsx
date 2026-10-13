import { Col, Form, Input, Row } from 'antd'
import { CGPA_RULE, GRADUATION_YEAR_RULE, NON_NEGATIVE_RULE, SCORE_RULE } from './validation/rules'
import { GUTTER } from '../theme'

export const BRANCH_OPTIONS = [
  'Computer Science & Engineering',
  'Electronics & Communication Engineering',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Chemical Engineering',
  'Civil Engineering',
  'Information Technology',
  'Production Engineering',
  'Biomedical Engineering',
  'Biotechnology',
  'Instrumentation Engineering',
  'Metallurgical Engineering',
  'Others',
].map((v) => ({ value: v, label: v }))

export const JOB_LOCATION_OPTIONS = ['Gurugram NCR', 'Coimbatore', 'Both'].map((v) => ({ value: v, label: v }))

// Marks, degrees and backlogs — shared by the apply form, the candidate page and the admin entry form.
// Candidates must give a batch and CGPA; an admin entering someone may not have them to hand.
export default function AcademicFields({ size = 'large', requireCore = true }) {
  return (
    <Row gutter={GUTTER}>
      <Col xs={24} sm={12}>
        <Form.Item
          name="graduationYear"
          label="Year of Graduation (Batch)"
          rules={[{ required: requireCore, message: 'Year of graduation is required' }, GRADUATION_YEAR_RULE]}
        >
          <Input type="number" placeholder="2026" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="tenthMark" label="10th Mark %" rules={[SCORE_RULE]}>
          <Input type="number" step="0.01" placeholder="92.5" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="twelfthMark" label="12th Mark %" rules={[SCORE_RULE]}>
          <Input type="number" step="0.01" placeholder="88.0" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="diplomaMark" label="Diploma Mark % (if applicable)" rules={[SCORE_RULE]}>
          <Input type="number" step="0.01" placeholder="85.0" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="keamRank" label="KEAM Rank (if applicable)" rules={[NON_NEGATIVE_RULE]}>
          <Input type="number" placeholder="1234" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="ugDegree" label="UG Specialization (if applicable)">
          <Input placeholder="B.Tech Computer Science" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="ugCgpa" label="UG CGPA" rules={[{ required: requireCore, message: 'UG CGPA is required' }, CGPA_RULE]}>
          <Input type="number" step="0.01" placeholder="8.5" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="pgDegree" label="PG Degree (if applicable)">
          <Input placeholder="M.Tech CSE" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="pgCgpa" label="PG CGPA (if applicable)" rules={[CGPA_RULE]}>
          <Input type="number" step="0.01" placeholder="9.0" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="arrears" label="Active Backlogs" rules={[NON_NEGATIVE_RULE]}>
          <Input type="number" placeholder="0" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="backlogs" label="Total Backlogs" rules={[NON_NEGATIVE_RULE]}>
          <Input type="number" placeholder="0" size={size} />
        </Form.Item>
      </Col>
    </Row>
  )
}
