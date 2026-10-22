import { useState } from 'react'
import { Button, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { exportXlsx } from '../api/exports'
import { tableToSheet } from '../utils/columns'
import { getErrorMessage } from '../utils/errorUtils'
import { saveFile } from '../utils/download'

// Downloads the table as an .xlsx in the layout it has on screen: shown columns in order, every filtered row.
// `mergeColumns` (indexes) merge runs of the same value down those columns, e.g. a Group column.
export default function DownloadExcel({ title, columns, rows, mergeColumns }) {
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      const res = await exportXlsx({ title, ...tableToSheet(columns, rows ?? []), mergeColumns })
      saveFile(res.data, `${title}.xlsx`)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button size="small" icon={<DownloadOutlined />} loading={busy} onClick={download}>
      Download Excel
    </Button>
  )
}
