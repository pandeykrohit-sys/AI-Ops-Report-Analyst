import { useState, useEffect, useCallback } from 'react';
import { Settings, Database, FileBarChart, RefreshCw, Download, ExternalLink, Loader2, CheckCircle, AlertCircle, Play, Eye } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

interface PowerBIConfig {
  id?: string;
  workspace_id: string;
  workspace_name?: string;
  tenant_id: string;
  client_id: string;
  client_secret?: string;
  service_principal_enabled: boolean;
}

interface PowerBIDataset {
  id: string;
  name: string;
  workspace_id: string;
  created_at: string;
}

interface PowerBIReport {
  id: string;
  name: string;
  datasetId: string;
  embedUrl?: string;
  webUrl?: string;
}

interface PowerBIIntegrationProps {
  fileData?: {
    headers: string[];
    rows: string[][];
  };
  rawData?: string;
}

type TabView = 'config' | 'datasets' | 'reports' | 'embed';

export function PowerBIIntegration({ fileData, rawData }: PowerBIIntegrationProps) {
  const [activeTab, setActiveTab] = useState<TabView>('config');
  const [config, setConfig] = useState<PowerBIConfig>({
    workspace_id: '',
    workspace_name: '',
    tenant_id: '',
    client_id: '',
    client_secret: '',
    service_principal_enabled: true
  });
  const [savedConfig, setSavedConfig] = useState<PowerBIConfig | null>(null);
  const [datasets, setDatasets] = useState<PowerBIDataset[]>([]);
  const [reports, setReports] = useState<PowerBIReport[]>([]);
  const [embedToken, setEmbedToken] = useState<string | null>(null);
  const [embedReport, setEmbedReport] = useState<PowerBIReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [datasetName, setDatasetName] = useState('Uploaded Dataset');
  const [refreshStatus, setRefreshStatus] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'PDF' | 'PPTX'>('PDF');
  const [exportStatus, setExportStatus] = useState<string>('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('powerbi_config')
        .select('*')
        .single();

      if (data) {
        setSavedConfig(data as PowerBIConfig);
        setConfig({
          ...data,
          client_secret: ''
        });
        setIsConfigured(true);
      }
    } catch (err) {
      // No config found
    }
  };

  const loadDatasets = async () => {
    if (!savedConfig) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/powerbi-proxy?action=get-datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            tenant_id: savedConfig.tenant_id,
            client_id: savedConfig.client_id,
            client_secret: savedConfig.client_secret,
            workspace_id: savedConfig.workspace_id
          }
        })
      });

      const result = await response.json();

      if (result.value) {
        setDatasets(result.value.map((d: any) => ({
          id: d.id,
          name: d.name,
          workspace_id: savedConfig.workspace_id,
          created_at: d.createdDateTime
        })));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    if (!savedConfig) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/powerbi-proxy?action=get-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            tenant_id: savedConfig.tenant_id,
            client_id: savedConfig.client_id,
            client_secret: savedConfig.client_secret,
            workspace_id: savedConfig.workspace_id
          }
        })
      });

      const result = await response.json();

      if (result.value) {
        setReports(result.value.map((r: any) => ({
          id: r.id,
          name: r.name,
          datasetId: r.datasetId,
          embedUrl: r.embedUrl,
          webUrl: r.webUrl
        })));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!supabase) {
      setError('Supabase not configured');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const configToSave = {
        workspace_id: config.workspace_id,
        workspace_name: config.workspace_name,
        tenant_id: config.tenant_id,
        client_id: config.client_id,
        client_secret_encrypted: config.client_secret,
        service_principal_enabled: config.service_principal_enabled
      };

      const { error: saveError } = await supabase
        .from('powerbi_config')
        .upsert(configToSave);

      if (saveError) throw saveError;

      setSuccess('Power BI configuration saved successfully!');
      setSavedConfig({
        ...config,
        client_secret: ''
      });
      setIsConfigured(true);

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishDataset = async () => {
    if (!savedConfig || !fileData) {
      setError('No data to publish or configuration missing');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const columns = fileData.headers.map(h => ({
        name: h.replace(/[^a-zA-Z0-9]/g, '_'),
        dataType: 'string',
        format: ''
      }));

      const rows = fileData.rows.map(row =>
        Object.fromEntries(
          columns.map((col, i) => [col.name, row[i] || ''])
        )
      );

      const response = await fetch('/api/powerbi-proxy?action=publish-dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            tenant_id: savedConfig.tenant_id,
            client_id: savedConfig.client_id,
            client_secret: savedConfig.client_secret || '',
            workspace_id: savedConfig.workspace_id
          },
          datasetName,
          data: {
            columns,
            rows
          }
        })
      });

      const result = await response.json();

      if (result.error) throw new Error(result.error);

      setSuccess(`Dataset "${datasetName}" published successfully!`);
      await loadDatasets();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshDataset = async (datasetId: string) => {
    if (!savedConfig) return;

    setRefreshStatus('Refreshing...');

    try {
      const response = await fetch('/api/powerbi-proxy?action=refresh-dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            tenant_id: savedConfig.tenant_id,
            client_id: savedConfig.client_id,
            client_secret: savedConfig.client_secret || '',
            workspace_id: savedConfig.workspace_id
          },
          datasetId
        })
      });

      const result = await response.json();

      if (result.error) throw new Error(result.error);

      setRefreshStatus('Refresh initiated successfully');
      setTimeout(() => setRefreshStatus(''), 3000);
    } catch (err: any) {
      setRefreshStatus(`Error: ${err.message}`);
    }
  };

  const handleGenerateEmbedToken = async (report: PowerBIReport) => {
    if (!savedConfig) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/powerbi-proxy?action=generate-embed-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            tenant_id: savedConfig.tenant_id,
            client_id: savedConfig.client_id,
            client_secret: savedConfig.client_secret || '',
            workspace_id: savedConfig.workspace_id
          },
          reportId: report.id,
          datasetId: report.datasetId
        })
      });

      const result = await response.json();

      if (result.error) throw new Error(result.error);

      setEmbedToken(result.token);
      setEmbedReport({
        ...report,
        embedUrl: result.embedUrl || report.embedUrl
      });
      setActiveTab('embed');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async (reportId: string, format: 'PDF' | 'PPTX') => {
    if (!savedConfig) return;

    setExportStatus(`Exporting to ${format}...`);
    setExportFormat(format);

    try {
      const response = await fetch('/api/powerbi-proxy?action=export-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            tenant_id: savedConfig.tenant_id,
            client_id: savedConfig.client_id,
            client_secret: savedConfig.client_secret || '',
            workspace_id: savedConfig.workspace_id
          },
          reportId,
          format
        })
      });

      const result = await response.json();

      if (result.error) throw new Error(result.error);

      if (result.id) {
        await pollExportStatus(reportId, result.id, format);
      }
    } catch (err: any) {
      setExportStatus(`Error: ${err.message}`);
    }
  };

  const pollExportStatus = async (reportId: string, exportId: string, format: string) => {
    if (!savedConfig) return;

    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await fetch('/api/powerbi-proxy?action=get-export-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            tenant_id: savedConfig.tenant_id,
            client_id: savedConfig.client_id,
            client_secret: savedConfig.client_secret || '',
            workspace_id: savedConfig.workspace_id
          },
          reportId,
          exportId
        })
      });

      const result = await response.json();

      if (result.status === 'Succeeded') {
        setExportStatus(`Export complete! Click to download.`);
        if (result.resourceLocation) {
          window.open(result.resourceLocation, '_blank');
        }
        setTimeout(() => setExportStatus(''), 5000);
        return;
      } else if (result.status === 'Failed') {
        setExportStatus(`Export failed`);
        return;
      }
    }

    setExportStatus('Export timeout - please try again');
  };

  const handleCreateReport = async (datasetId: string) => {
    if (!savedConfig) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/powerbi-proxy?action=create-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            tenant_id: savedConfig.tenant_id,
            client_id: savedConfig.client_id,
            client_secret: savedConfig.client_secret || '',
            workspace_id: savedConfig.workspace_id
          },
          datasetId,
          reportName: `${datasetName} Report`
        })
      });

      const result = await response.json();

      if (result.error) throw new Error(result.error);

      setSuccess('Report created successfully!');
      await loadReports();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConfigured && activeTab === 'datasets') {
      loadDatasets();
    } else if (isConfigured && activeTab === 'reports') {
      loadReports();
    }
  }, [activeTab, isConfigured]);

  return (
    <div className="bg-[#0d2818] rounded-2xl p-6 shadow-xl border border-[#2d5a3d]">
      <div className="flex items-center gap-3 mb-6">
        <FileBarChart className="w-6 h-6 text-[#fbbf24]" />
        <h2 className="text-xl font-semibold">Power BI Integration</h2>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-[#4d1a1a] rounded-lg border border-[#8b3a3a] mb-4">
          <AlertCircle className="w-5 h-5 text-[#f87171] flex-shrink-0" />
          <p className="text-[#fca5a5]">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 p-4 bg-[#1a4d2e] rounded-lg border border-[#4ade80] mb-4">
          <CheckCircle className="w-5 h-5 text-[#4ade80] flex-shrink-0" />
          <p className="text-[#a7c4bc]">{success}</p>
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {(['config', 'datasets', 'reports', 'embed'] as TabView[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab
                ? 'bg-[#2d7a4e] text-white'
                : 'bg-[#1a4d2e] text-[#a7c4bc] hover:bg-[#2d5a3d]'
            }`}
          >
            {tab === 'config' && <Settings className="w-4 h-4 inline mr-2" />}
            {tab === 'datasets' && <Database className="w-4 h-4 inline mr-2" />}
            {tab === 'reports' && <FileBarChart className="w-4 h-4 inline mr-2" />}
            {tab === 'embed' && <Eye className="w-4 h-4 inline mr-2" />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'config' && (
        <div className="space-y-4">
          <div className="bg-[#1a4d2e] rounded-xl p-6 border border-[#3d6b4d]">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#60a5fa]" />
              Microsoft Entra ID Authentication
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[#a7c4bc] text-sm block mb-2">Tenant ID</label>
                <input
                  type="text"
                  value={config.tenant_id}
                  onChange={(e) => setConfig({ ...config, tenant_id: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full px-4 py-3 bg-[#0d2818] border border-[#3d6b4d] rounded-xl text-white placeholder-[#6b9a85] focus:outline-none focus:border-[#5a9a6f]"
                />
              </div>

              <div>
                <label className="text-[#a7c4bc] text-sm block mb-2">Client ID (Application ID)</label>
                <input
                  type="text"
                  value={config.client_id}
                  onChange={(e) => setConfig({ ...config, client_id: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full px-4 py-3 bg-[#0d2818] border border-[#3d6b4d] rounded-xl text-white placeholder-[#6b9a85] focus:outline-none focus:border-[#5a9a6f]"
                />
              </div>

              <div>
                <label className="text-[#a7c4bc] text-sm block mb-2">Client Secret</label>
                <input
                  type="password"
                  value={config.client_secret || ''}
                  onChange={(e) => setConfig({ ...config, client_secret: e.target.value })}
                  placeholder="Enter client secret"
                  className="w-full px-4 py-3 bg-[#0d2818] border border-[#3d6b4d] rounded-xl text-white placeholder-[#6b9a85] focus:outline-none focus:border-[#5a9a6f]"
                />
              </div>

              <div>
                <label className="text-[#a7c4bc] text-sm block mb-2">Workspace ID (Group ID)</label>
                <input
                  type="text"
                  value={config.workspace_id}
                  onChange={(e) => setConfig({ ...config, workspace_id: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full px-4 py-3 bg-[#0d2818] border border-[#3d6b4d] rounded-xl text-white placeholder-[#6b9a85] focus:outline-none focus:border-[#5a9a6f]"
                />
              </div>

              <div>
                <label className="text-[#a7c4bc] text-sm block mb-2">Workspace Name (Optional)</label>
                <input
                  type="text"
                  value={config.workspace_name || ''}
                  onChange={(e) => setConfig({ ...config, workspace_name: e.target.value })}
                  placeholder="My Workspace"
                  className="w-full px-4 py-3 bg-[#0d2818] border border-[#3d6b4d] rounded-xl text-white placeholder-[#6b9a85] focus:outline-none focus:border-[#5a9a6f]"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="service-principal"
                  checked={config.service_principal_enabled}
                  onChange={(e) => setConfig({ ...config, service_principal_enabled: e.target.checked })}
                  className="w-4 h-4 accent-[#4ade80]"
                />
                <label htmlFor="service-principal" className="text-[#a7c4bc]">
                  Use Service Principal Authentication
                </label>
              </div>

              <button
                onClick={handleSaveConfig}
                disabled={loading || !config.tenant_id || !config.client_id || !config.workspace_id}
                className="w-full py-3 px-6 bg-[#2d7a4e] hover:bg-[#3d9a5e] disabled:bg-[#1d4a2e] disabled:cursor-not-allowed rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'datasets' && !isConfigured && (
        <div className="text-center py-8 text-[#a7c4bc]">
          <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Please configure Power BI settings first</p>
        </div>
      )}

      {activeTab === 'datasets' && isConfigured && (
        <div className="space-y-4">
          {fileData && (
            <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#4ade80]">
              <h4 className="font-semibold mb-4 text-[#4ade80]">Publish New Dataset from Uploaded File</h4>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  placeholder="Dataset name"
                  className="flex-1 px-4 py-2 bg-[#0d2818] border border-[#3d6b4d] rounded-lg text-white"
                />
                <button
                  onClick={handlePublishDataset}
                  disabled={loading}
                  className="px-6 py-2 bg-[#2d7a4e] hover:bg-[#3d9a5e] rounded-lg font-medium flex items-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  Publish
                </button>
              </div>
            </div>
          )}

          <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#3d6b4d]">
            <h4 className="font-semibold mb-4">Existing Datasets</h4>
            {loading && !datasets.length ? (
              <div className="text-center py-4">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#4ade80]" />
              </div>
            ) : datasets.length === 0 ? (
              <p className="text-[#6b9a85] text-center py-4">No datasets found</p>
            ) : (
              <div className="space-y-3">
                {datasets.map((dataset) => (
                  <div key={dataset.id} className="flex items-center justify-between p-4 bg-[#0d2818] rounded-lg">
                    <div>
                      <p className="font-medium">{dataset.name}</p>
                      <p className="text-sm text-[#6b9a85]">ID: {dataset.id.substring(0, 8)}...</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRefreshDataset(dataset.id)}
                        disabled={!!refreshStatus}
                        className="p-2 bg-[#2d5a3d] hover:bg-[#3d7a5d] rounded-lg transition-colors"
                        title="Refresh Dataset"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCreateReport(dataset.id)}
                        className="p-2 bg-[#2d5a3d] hover:bg-[#3d7a5d] rounded-lg transition-colors"
                        title="Create Report"
                      >
                        <FileBarChart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {refreshStatus && <p className="text-sm mt-3 text-[#a7c4bc]">{refreshStatus}</p>}
          </div>
        </div>
      )}

      {activeTab === 'reports' && !isConfigured && (
        <div className="text-center py-8 text-[#a7c4bc]">
          <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Please configure Power BI settings first</p>
        </div>
      )}

      {activeTab === 'reports' && isConfigured && (
        <div className="space-y-4">
          <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#3d6b4d]">
            <h4 className="font-semibold mb-4">Power BI Reports</h4>
            {loading && !reports.length ? (
              <div className="text-center py-4">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#4ade80]" />
              </div>
            ) : reports.length === 0 ? (
              <p className="text-[#6b9a85] text-center py-4">No reports found</p>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-4 bg-[#0d2818] rounded-lg">
                    <div>
                      <p className="font-medium">{report.name}</p>
                      <p className="text-sm text-[#6b9a85]">ID: {report.id.substring(0, 8)}...</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGenerateEmbedToken(report)}
                        className="px-3 py-2 bg-[#2d7a4e] hover:bg-[#3d9a5e] rounded-lg text-sm font-medium flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Embed
                      </button>
                      {report.webUrl && (
                        <a
                          href={report.webUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-[#2d5a3d] hover:bg-[#3d7a5d] rounded-lg transition-colors"
                          title="Open in Power BI"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => handleExportReport(report.id, 'PDF')}
                        disabled={exportStatus.includes('Exporting')}
                        className="p-2 bg-[#2d5a3d] hover:bg-[#3d7a5d] rounded-lg transition-colors"
                        title="Export to PDF"
                      >
                        {exportFormat === 'PDF' && exportStatus.includes('Exporting') ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleExportReport(report.id, 'PPTX')}
                        disabled={exportStatus.includes('Exporting')}
                        className="p-2 bg-[#2d5a3d] hover:bg-[#3d7a5d] rounded-lg transition-colors"
                        title="Export to PPTX"
                      >
                        {exportFormat === 'PPTX' && exportStatus.includes('Exporting') ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileBarChart className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {exportStatus && <p className="text-sm mt-3 text-[#a7c4bc]">{exportStatus}</p>}
          </div>
        </div>
      )}

      {activeTab === 'embed' && !embedToken && (
        <div className="text-center py-8 text-[#a7c4bc]">
          <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a report to embed from the Reports tab</p>
        </div>
      )}

      {activeTab === 'embed' && embedToken && embedReport && (
        <div className="space-y-4">
          <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#3d6b4d]">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">{embedReport.name}</h4>
              <button
                onClick={() => {
                  setEmbedToken(null);
                  setEmbedReport(null);
                }}
                className="px-3 py-1 bg-[#2d5a3d] hover:bg-[#3d7a5d] rounded-lg text-sm"
              >
                Close
              </button>
            </div>

            <div
              className="w-full bg-[#0d2818] rounded-lg overflow-hidden"
              style={{ height: '500px' }}
            >
              <iframe
                title={embedReport.name}
                width="100%"
                height="100%"
                src={`${embedReport.embedUrl}?token=${embedToken}`}
                style={{ border: 'none' }}
                allowFullScreen={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
