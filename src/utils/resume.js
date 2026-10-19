// Mirrors ResumeService.MAX_BYTES on the backend.
export const MAX_RESUME_BYTES = 5 * 1024 * 1024
export const RESUME_TOO_LARGE = 'Resume must be 5 MB or smaller'
export const resumeTooLarge = (file) => file.size > MAX_RESUME_BYTES
