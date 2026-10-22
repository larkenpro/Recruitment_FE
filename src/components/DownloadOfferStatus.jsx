import { useState } from 'react'
import { Button, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { getErrorMessage } from '../utils/errorUtils'
import { saveFile } from '../utils/download'

// Downloads the team's offer-status sheet: `request()` asks the backend for it (an .xlsx blob).
export default function DownloadOfferStatus({ request, fileName, disabled }) {
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      saveFile((await request()).data, fileName)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button size="small" icon={<DownloadOutlined />} disabled={disabled} loading={busy} onClick={download}>
      Download Offer Status
    </Button>
  )
}
