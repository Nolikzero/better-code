// Mock file upload hook for desktop app
import { useState } from "react"

export function useAgentsFileUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])

  const uploadFile = async (file: File) => {
    setIsUploading(true)
    // Mock upload
    setUploadedFiles(prev => [...prev, file])
    setIsUploading(false)
    return { url: URL.createObjectURL(file), filename: file.name }
  }

  const clearFiles = () => setUploadedFiles([])

  return {
    isUploading,
    uploadedFiles,
    uploadFile,
    clearFiles,
  }
}
