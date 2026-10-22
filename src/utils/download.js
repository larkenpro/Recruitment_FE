// Hands the browser a file to save, e.g. an .xlsx the API returned as a blob.
export function saveFile(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
