'use client';

import { useState, useRef } from 'react';
import { Mic, Upload, FileAudio, Copy, Download, Loader2, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ScribeNote() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('audio/')) {
      setFile(droppedFile);
      setError('');
    } else {
      setError('Please drop a valid audio file.');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const [uploadProgress, setUploadProgress] = useState(0);

  const handleTranscribe = async () => {
    if (!file) return;

    setIsTranscribing(true);
    setError('');
    setTranscript('');
    setUploadProgress(0);

    try {
      // 1. Get upload URL
      const getUploadUrlRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'audio/mp3',
          size: file.size,
        })
      });

      if (!getUploadUrlRes.ok) {
        const errorData = await getUploadUrlRes.json();
        throw new Error(errorData.error || 'Failed to initialize upload');
      }

      const { uploadUrl } = await getUploadUrlRes.json();
      setUploadProgress(10);

      // 2. Upload file directly to Gemini
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'X-Goog-Upload-Offset': '0',
          'X-Goog-Upload-Command': 'upload, finalize',
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to Gemini');
      }

      const uploadData = await uploadRes.json();
      setUploadProgress(50);

      // 3. Transcribe
      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUri: uploadData.file.uri,
          mimeType: uploadData.file.mimeType,
          name: uploadData.file.name,
        })
      });

      if (!transcribeRes.ok) {
        const errorData = await transcribeRes.json();
        throw new Error(errorData.error || 'Transcription failed');
      }

      const data = await transcribeRes.json();
      setTranscript(data.text);
      setUploadProgress(100);
    } catch (err: any) {
      setError(err.message || 'An error occurred during transcription.');
    } finally {
      setIsTranscribing(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTranscript = () => {
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${file?.name || 'audio'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-200">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Mic size={20} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">ScribeNote</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <div className="space-y-8">
          {/* Upload Section */}
          <section>
            <div className="mb-4">
              <h2 className="text-2xl font-semibold tracking-tight">Transcribe Audio</h2>
              <p className="text-gray-500 mt-1">Upload an audio file to get a full text transcription.</p>
            </div>

            <div
              className={`relative border-2 border-dashed rounded-2xl p-8 md:p-12 text-center transition-colors ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'
              } ${isTranscribing ? 'opacity-50 pointer-events-none' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
              
              {!file ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2">
                    <Upload size={32} />
                  </div>
                  <div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 font-medium hover:underline focus:outline-none"
                    >
                      Click to upload
                    </button>
                    <span className="text-gray-500"> or drag and drop</span>
                  </div>
                  <p className="text-sm text-gray-400">MP3, WAV, M4A, OGG, FLAC, AAC, OPUS (Max 500MB)</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 w-full max-w-md text-left">
                    <div className="bg-blue-100 text-blue-600 p-3 rounded-lg flex-shrink-0">
                      <FileAudio size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setTranscript('');
                        setError('');
                      }}
                      className="text-gray-400 hover:text-gray-600 p-2"
                      title="Remove file"
                    >
                      &times;
                    </button>
                  </div>

                  <button
                    onClick={handleTranscribe}
                    disabled={isTranscribing}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-medium transition-colors flex items-center gap-2 disabled:opacity-70 relative overflow-hidden"
                  >
                    {isTranscribing && (
                      <div 
                        className="absolute left-0 top-0 bottom-0 bg-blue-800/30 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    )}
                    <div className="relative flex items-center gap-2">
                      {isTranscribing ? (
                        <>
                          <Loader2 size={20} className="animate-spin" />
                          {uploadProgress < 50 ? 'Uploading...' : 'Transcribing...'}
                        </>
                      ) : (
                        <>
                          <Mic size={20} />
                          Start Transcription
                        </>
                      )}
                    </div>
                  </button>
                </div>
              )}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100"
              >
                <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </motion.div>
            )}
          </section>

          {/* Transcript Section */}
          <AnimatePresence>
            {transcript && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <h3 className="font-semibold text-gray-900">Transcript</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={downloadTranscript}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Download size={16} />
                      Download
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="prose prose-blue max-w-none">
                    <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                      {transcript}
                    </p>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
