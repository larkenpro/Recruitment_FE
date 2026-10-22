import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Modal, Space, Tag, message } from 'antd'
import { EditOutlined, FileTextOutlined } from '@ant-design/icons'
import { getCandidateResume, getResumeFile } from '../api/candidates'
import { preferenceLabel } from '../utils/preferences'
import EventApplicationModal from './EventApplicationModal'

// Sorts on a numeric field, blanks first in ascending order.
const byNumber = (field) => (a, b) => (a[field] ?? -1) - (b[field] ?? -1)
const mark = (field, title) => ({ key: field, title, dataIndex: field, sorter: byNumber(field), render: (v) => v ?? '—' })

/**
 * The candidate fields every stage table can show as columns (rows are event applications), plus the
 * resume viewer and application editor their Resume and Details buttons open. Render `modals` once.
 * `positionsFor(eventId)` gives the editor that event's positions; `addCandidate(eventId)` opens it empty.
 */
export function useCandidateColumns(positionsFor) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [resume, setResume] = useState(null)
  // { eventId, application } — application null to add someone.
  const [editing, setEditing] = useState(null)

  // /resume/view and /resume/download require a JWT, which a plain <iframe src>/<a href>
  // can't send — fetch the bytes through the authed axios instance and hand the
  // iframe/download button a blob: URL instead (mirrors CandidateDetail.jsx).
  const viewResume = async (candidateId) => {
    try {
      const res = await getCandidateResume(candidateId)
      const fileName = res.data.data?.fileName ?? null
      const fileRes = await getResumeFile(candidateId)
      setResume({ fileName, blobUrl: URL.createObjectURL(fileRes.data) })
    } catch {
      message.error('No resume found for this candidate')
    }
  }

  const closeResume = () => {
    if (resume?.blobUrl) URL.revokeObjectURL(resume.blobUrl)
    setResume(null)
  }

  const columns = {
    name: {
      key: 'name',
      title: 'Name',
      dataIndex: 'name',
      render: (t, r) => (
        <a onClick={() => navigate(`/candidates/${r.candidateId}`)}>
          <strong>{t}</strong>
        </a>
      ),
    },
    rollNo: { key: 'rollNo', title: 'Roll No', dataIndex: 'rollNo', render: (v) => v || '—' },
    email: { key: 'email', title: 'Email', dataIndex: 'email' },
    phone: { key: 'phone', title: 'Phone', dataIndex: 'phone', render: (v) => v || '—' },
    branch: { key: 'branch', title: 'Branch', dataIndex: 'branch', render: (v) => v || '—' },
    batch: { key: 'batch', title: 'Batch', dataIndex: 'graduationYear', render: (v) => v ?? '—' },
    tenthMark: mark('tenthMark', '10th %'),
    twelfthMark: mark('twelfthMark', '12th %'),
    diplomaMark: mark('diplomaMark', 'Diploma %'),
    ugCgpa: mark('ugCgpa', 'UG CGPA'),
    pgCgpa: mark('pgCgpa', 'PG CGPA'),
    keamRank: mark('keamRank', 'KEAM Rank'),
    activeBacklogs: {
      key: 'activeBacklogs',
      title: 'Active Backlogs',
      dataIndex: 'arrears',
      sorter: byNumber('arrears'),
      exportValue: (r) => r.arrears ?? 0,
      render: (v) => <Tag color={(v ?? 0) === 0 ? 'green' : 'red'}>{v ?? 0}</Tag>,
    },
    preferences: {
      key: 'preferences',
      title: 'Preferences',
      exportValue: (r) => (r.preferences ?? []).map((p, i) => `${i + 1}. ${preferenceLabel(p)}`).join('\n'),
      render: (_, r) => (r.preferences ?? []).map((p, i) => (
        <div key={i} style={{ whiteSpace: 'nowrap' }}>{i + 1}. {preferenceLabel(p)}</div>
      )),
    },
    backlogs: {
      key: 'backlogs',
      title: 'Total Backlogs',
      dataIndex: 'backlogs',
      sorter: byNumber('backlogs'),
      exportValue: (r) => r.backlogs ?? 0,
      render: (v) => <Tag color={(v ?? 0) === 0 ? 'green' : 'red'}>{v ?? 0}</Tag>,
    },
    resume: {
      key: 'resume',
      title: 'Resume',
      noExport: true,
      render: (_, r) => (
        <Button size="small" icon={<FileTextOutlined />} onClick={() => viewResume(r.candidateId)}>
          View
        </Button>
      ),
    },
    details: {
      key: 'details',
      title: 'Details',
      noExport: true,
      render: (_, r) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => setEditing({ eventId: r.eventId, application: r })}>
          Edit
        </Button>
      ),
    },
  }

  const modals = (
    <>
      <Modal
        open={!!resume}
        title={
          <Space>
            <FileTextOutlined style={{ color: '#4f46e5' }} />
            <span>{resume?.fileName ?? 'Resume'}</span>
          </Space>
        }
        onCancel={closeResume}
        footer={[
          <Button key="download" href={resume?.blobUrl} download={resume?.fileName} disabled={!resume?.blobUrl}>
            Download
          </Button>,
          <Button key="close" type="primary" onClick={closeResume}>
            Close
          </Button>,
        ]}
        width={900}
        styles={{ body: { padding: 0 } }}
      >
        {resume?.blobUrl && resume.fileName?.toLowerCase().endsWith('.pdf') ? (
          <iframe src={resume.blobUrl} style={{ width: '100%', height: 620, border: 'none' }} title={resume.fileName} />
        ) : (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <FileTextOutlined style={{ fontSize: 40, color: '#9ca3af', marginBottom: 12 }} />
            <div style={{ color: '#6b7280', marginBottom: 16 }}>
              Preview not available for this file type.
            </div>
          </div>
        )}
      </Modal>

      <EventApplicationModal
        open={!!editing}
        eventId={editing?.eventId}
        eventPositions={editing ? positionsFor(editing.eventId) : undefined}
        application={editing?.application}
        onClose={() => setEditing(null)}
        onSaved={() => {
          const eventId = String(editing.eventId)
          setEditing(null)
          queryClient.invalidateQueries({ queryKey: ['eventCandidates', eventId] })
          queryClient.invalidateQueries({ queryKey: ['eventStageSummary', eventId] })
          queryClient.invalidateQueries({ queryKey: ['roundGroups', eventId] })
          queryClient.invalidateQueries({ queryKey: ['offers'] })
        }}
      />
    </>
  )

  return { columns, modals, addCandidate: (eventId) => setEditing({ eventId, application: null }) }
}
