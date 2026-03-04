import { useState, useCallback } from 'react'

interface UseConnectionTestReturn {
  testing: boolean
  testResult: string | null
  runTest: (testFn: () => Promise<void>) => Promise<boolean>
  resetResult: () => void
}

export function useConnectionTest(): UseConnectionTestReturn {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const runTest = useCallback(async (testFn: () => Promise<void>): Promise<boolean> => {
    setTesting(true)
    setTestResult(null)
    try {
      await testFn()
      setTestResult('Connection successful')
      return true
    } catch (err) {
      setTestResult(String(err))
      return false
    } finally {
      setTesting(false)
    }
  }, [])

  const resetResult = useCallback(() => {
    setTestResult(null)
  }, [])

  return { testing, testResult, runTest, resetResult }
}
