import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';

const ViewerContainer = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing(6)};
  box-shadow: ${({ theme }) => theme.shadows.md};
  animation: ${({ theme }) => theme.animations.slideIn};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing(6)};
  padding-bottom: ${({ theme }) => theme.spacing(4)};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};

  @media (max-width: 768px) {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing(4)};
    align-items: stretch;
  }
`;

const Title = styled.h2`
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.h2};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const Controls = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
  align-items: center;

  @media (max-width: 768px) {
    flex-direction: column;
    width: 100%;
  }
`;

const ReportSelect = styled.select`
  background: #1f1d20;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  padding: 12px 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #bdbdbd;
  cursor: pointer;
  min-width: 200px;
  transition: all 0.15s ease;

  &:hover {
    border-color: rgba(80, 250, 123, 0.4);
  }

  &:focus {
    outline: none;
    border-color: #50fa7b;
    box-shadow: 0 0 0 2px rgba(80, 250, 123, 0.2);
  }

  option {
    background: #1f1d20;
    color: #bdbdbd;
    padding: 12px;
  }

  @media (max-width: 768px) {
    width: 100%;
    min-width: unset;
  }
`;

const Button = styled.button`
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  transition: all 0.15s ease;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &:hover {
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.background};
    box-shadow: ${({ theme }) => theme.shadows.glow};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const ContentContainer = styled.div`
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing(6)};
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.background};
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.primary};
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: ${({ theme }) => theme.colors.primary}CC;
  }

  @media (max-width: 768px) {
    max-height: 400px;
    padding: ${({ theme }) => theme.spacing(4)};
  }
`;

const MarkdownContent = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  color: ${({ theme }) => theme.colors.textPrimary};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};

  h1, h2, h3, h4, h5, h6 {
    font-family: ${({ theme }) => theme.typography.fontFamily.primary};
    color: ${({ theme }) => theme.colors.primary};
    margin-top: ${({ theme }) => theme.spacing(6)};
    margin-bottom: ${({ theme }) => theme.spacing(4)};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  }

  h1 {
    font-size: ${({ theme }) => theme.typography.fontSize.h1};
    border-bottom: 2px solid ${({ theme }) => theme.colors.primary};
    padding-bottom: ${({ theme }) => theme.spacing(2)};
  }

  h2 {
    font-size: ${({ theme }) => theme.typography.fontSize.h2};
  }

  h3 {
    font-size: ${({ theme }) => theme.typography.fontSize.h3};
  }

  p {
    margin-bottom: ${({ theme }) => theme.spacing(4)};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  }

  code {
    font-family: ${({ theme }) => theme.typography.fontFamily.primary};
    background: ${({ theme }) => theme.colors.surface};
    padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    color: ${({ theme }) => theme.colors.primary};
  }

  pre {
    background: ${({ theme }) => theme.colors.surface}!important;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    padding: ${({ theme }) => theme.spacing(4)}!important;
    overflow-x: auto;
    margin-bottom: ${({ theme }) => theme.spacing(4)};

    code {
      background: transparent;
      padding: 0;
    }
  }

  ul, ol {
    margin-bottom: ${({ theme }) => theme.spacing(4)};
    padding-left: ${({ theme }) => theme.spacing(6)};
  }

  li {
    margin-bottom: ${({ theme }) => theme.spacing(2)};
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: ${({ theme }) => theme.spacing(4)};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
  }

  th, td {
    padding: ${({ theme }) => theme.spacing(3)};
    text-align: left;
    border: 1px solid ${({ theme }) => theme.colors.border};
  }

  th {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.primary};
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  tr:nth-child(even) {
    background: ${({ theme }) => theme.colors.surface}40;
  }

  blockquote {
    border-left: 4px solid ${({ theme }) => theme.colors.primary};
    padding-left: ${({ theme }) => theme.spacing(4)};
    margin: ${({ theme }) => `${theme.spacing(4)} 0`};
    color: ${({ theme }) => theme.colors.textSecondary};
    font-style: italic;
  }

  a {
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: none;
    border-bottom: 1px solid ${({ theme }) => theme.colors.primary}40;
    transition: all 0.15s ease;

    &:hover {
      border-bottom-color: ${({ theme }) => theme.colors.primary};
    }
  }

  hr {
    border: none;
    border-top: 1px solid ${({ theme }) => theme.colors.divider};
    margin: ${({ theme }) => `${theme.spacing(6)} 0`};
  }

  strong {
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  em {
    font-style: italic;
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const LoadingSpinner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(8)};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
`;

const ErrorMessage = styled.div`
  padding: ${({ theme }) => theme.spacing(4)};
  background: ${({ theme }) => theme.colors.statusCritical}15;
  border: 1px solid ${({ theme }) => theme.colors.statusCritical};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.statusCritical};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const EmptyState = styled.div`
  padding: ${({ theme }) => theme.spacing(8)};
  text-align: center;
  color: ${({ theme }) => theme.colors.textDisabled};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
`;

const reports = [
  { id: 'validation', label: 'System Validation Report', file: 'report-validation.md' },
  { id: 'health', label: 'Health Score Report', file: 'report-health.md' },
  { id: 'drift', label: 'Drift Prediction Report', file: 'report-drift.md' },
];

export function ReportsViewer() {
  const [selectedReport, setSelectedReport] = useState(reports[0].id);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      const report = reports.find(r => r.id === selectedReport);
      if (!report) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/${report.file}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch report: ${response.statusText}`);
        }
        const text = await response.text();
        setContent(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [selectedReport]);

  const handleDownload = () => {
    const report = reports.find(r => r.id === selectedReport);
    if (!report || !content) return;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = report.file;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ViewerContainer>
      <Header>
        <Title>Reports Viewer</Title>
        <Controls>
          <ReportSelect
            value={selectedReport}
            onChange={(e) => setSelectedReport(e.target.value)}
          >
            {reports.map(report => (
              <option key={report.id} value={report.id}>
                {report.label}
              </option>
            ))}
          </ReportSelect>
          <Button onClick={handleDownload} disabled={!content || loading}>
            Download
          </Button>
        </Controls>
      </Header>

      <ContentContainer>
        {loading && <LoadingSpinner>Loading report...</LoadingSpinner>}
        {error && <ErrorMessage>⚠️ {error}</ErrorMessage>}
        {!loading && !error && !content && (
          <EmptyState>No report content available</EmptyState>
        )}
        {!loading && !error && content && (
          <MarkdownContent>
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
              {content}
            </ReactMarkdown>
          </MarkdownContent>
        )}
      </ContentContainer>
    </ViewerContainer>
  );
}
