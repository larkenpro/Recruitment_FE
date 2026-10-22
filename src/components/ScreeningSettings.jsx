import { Alert, Button, Col, Divider, Form, InputNumber, Row, Select, Typography, message } from 'antd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateEventScreening } from '../api/events'
import { DEFAULT_ROUND_WEIGHT, screen } from '../utils/screening'
import { getErrorMessage } from '../utils/errorUtils'
import { BRANCH_OPTIONS } from './AcademicFields'
import { GUTTER } from '../theme'

const { Text } = Typography

const OFF = 'Off'

/**
 * The event's eligibility criteria and fit-score weights — the academic ones, and one per round
 * (`rounds`, in pipeline order; empty = 1). An empty criterion is off. The preview counts how many
 * of the event's applications the unsaved values would pass.
 */
export default function ScreeningSettings({ eventId, screening, applications, rounds = [] }) {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const values = Form.useWatch([], form)

  const save = useMutation({
    mutationFn: (v) => updateEventScreening(eventId, v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      message.success('Screening saved')
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const draft = { ...screening, ...values }
  const eligible = (applications ?? []).filter((a) => screen(a, draft).eligible).length
  const branchOptions = [...new Set([
    ...BRANCH_OPTIONS.map((o) => o.value),
    ...(applications ?? []).map((a) => a.branch).filter(Boolean),
    ...(screening?.allowedBranches ?? []),
  ])].map((b) => ({ value: b, label: b }))

  const number = (name, label, props) => (
    <Col key={String(name)} xs={24} sm={12} md={8}>
      <Form.Item name={name} label={label}>
        <InputNumber style={{ width: '100%' }} placeholder={OFF} {...props} />
      </Form.Item>
    </Col>
  )

  return (
    <Form
      key={JSON.stringify(screening)}
      form={form}
      layout="vertical"
      initialValues={screening}
      onFinish={(v) => save.mutate({
        ...v,
        allowedBranches: v.allowedBranches ?? [],
        // An empty box is the default weight, so it isn't stored.
        roundWeights: Object.fromEntries(Object.entries(v.roundWeights ?? {}).filter(([, w]) => w != null)),
      })}
    >
      <Divider orientation="left" style={{ marginTop: 0 }}>Eligibility</Divider>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Leave a field empty to not check it. Diploma % counts as 12th when 12th is blank.
      </Text>
      <Row gutter={GUTTER}>
        {number('minTenth', 'Minimum 10th %', { min: 0, max: 100 })}
        {number('minTwelfth', 'Minimum 12th / Diploma %', { min: 0, max: 100 })}
        {number('minCgpa', 'Minimum CGPA', { min: 0, max: 10, step: 0.1 })}
        {number('maxActiveBacklogs', 'Maximum active backlogs', { min: 0, precision: 0 })}
        {number('maxTotalBacklogs', 'Maximum total backlogs', { min: 0, precision: 0 })}
        {number('batch', 'Batch (year of graduation)', { min: 1980, max: 2100, precision: 0 })}
        <Col xs={24}>
          <Form.Item name="allowedBranches" label="Branches" extra="Empty takes every branch.">
            <Select mode="tags" allowClear placeholder="Every branch" options={branchOptions} />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left">Fit score weights</Divider>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Fit score = the weighted average, out of 100, of 10th%, 12th%, CGPA×10 and — from each round on — every
        round score so far as a percentage of its maximum marks. A missing mark counts as 0; a round not scored yet
        is left out. The Resume table uses the marks only, a round&apos;s table adds that round and the rounds
        before it, and the Offer table adds every round.
      </Text>
      <Row gutter={GUTTER}>
        {number('weightTenth', '10th weight', { min: 0, step: 0.1, placeholder: '0' })}
        {number('weightTwelfth', '12th / Diploma weight', { min: 0, step: 0.1, placeholder: '0' })}
        {number('weightCgpa', 'CGPA weight', { min: 0, step: 0.1, placeholder: '0' })}
      </Row>
      {rounds.length > 0 && (
        <Row gutter={GUTTER}>
          {rounds.map((r) => number(['roundWeights', String(r.id)], `${r.name} weight`, {
            min: 0, step: 0.1, placeholder: String(DEFAULT_ROUND_WEIGHT),
          }))}
        </Row>
      )}

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={`With these settings ${eligible} of ${applications?.length ?? 0} applicants are eligible`}
      />
      <Button type="primary" htmlType="submit" loading={save.isPending}>Save screening</Button>
    </Form>
  )
}
