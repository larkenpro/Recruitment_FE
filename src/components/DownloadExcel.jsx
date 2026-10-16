import { useState } from 'react'
import { Button, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { exportXlsx } from '../api/exports'
import { tableToSheet } from '../utils/columns'
import { getErrorMessage } from '../utils/errorUtils'

// Downloads the table as an .xlsx in the layout it has on screen: shown columns in order, every filtered row.
export default function DownloadExcel({ title, columns, rows }) {
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      const res = await exportXlsx({ title, ...tableToSheet(columns, rows ?? []) })
      const url = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `${title}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
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
