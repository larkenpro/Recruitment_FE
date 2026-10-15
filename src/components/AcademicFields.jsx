import { Col, Form, Input, Row } from 'antd'
import { CGPA_RULE, COUNT_RULE, GRADUATION_YEAR_RULE, SCORE_RULE } from './validation/rules'
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
// Text inputs with a numeric keypad, not type="number": that one lets "1e5" through and, in Firefox,
// reports typed letters as an empty value, so the rules below would never see them.
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
          <Input inputMode="numeric" placeholder="2026" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="tenthMark" label="10th Mark %" rules={[SCORE_RULE]}>
          <Input inputMode="decimal" placeholder="92.5" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="twelfthMark" label="12th Mark %" rules={[SCORE_RULE]}>
          <Input inputMode="decimal" placeholder="88.0" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="diplomaMark" label="Diploma Mark % (if applicable)" rules={[SCORE_RULE]}>
          <Input inputMode="decimal" placeholder="85.0" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="keamRank" label="KEAM Rank (if applicable)" rules={[COUNT_RULE]}>
          <Input inputMode="numeric" placeholder="1234" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="ugDegree" label="UG Specialization (if applicable)">
          <Input placeholder="B.Tech Computer Science" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="ugCgpa" label="UG CGPA" rules={[{ required: requireCore, message: 'UG CGPA is required' }, CGPA_RULE]}>
          <Input inputMode="decimal" placeholder="8.5" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="pgDegree" label="PG Degree (if applicable)">
          <Input placeholder="M.Tech CSE" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="pgCgpa" label="PG CGPA (if applicable)" rules={[CGPA_RULE]}>
          <Input inputMode="decimal" placeholder="9.0" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="arrears" label="Active Backlogs" rules={[COUNT_RULE]}>
          <Input inputMode="numeric" placeholder="0" size={size} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={12}>
        <Form.Item name="backlogs" label="Total Backlogs" rules={[COUNT_RULE]}>
          <Input inputMode="numeric" placeholder="0" size={size} />
        </Form.Item>
      </Col>
    </Row>
  )
}
