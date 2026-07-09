import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const POWERBI_RESOURCE = "https://analysis.windows.net/powerbi/api";
const MICROSOFT_GRAPH = "https://graph.microsoft.com/.default";

interface PowerBIConfig {
  tenant_id: string;
  client_id: string;
  client_secret: string;
  workspace_id: string;
}

async function getAccessToken(config: PowerBIConfig): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.client_id,
    client_secret: config.client_secret,
    scope: "https://analysis.windows.net/powerbi/api/.default"
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function publishDataset(accessToken: string, workspaceId: string, datasetName: string, data: any) {
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: datasetName,
      tables: [{
        name: "Data",
        columns: data.columns || [],
        rows: data.rows || []
      }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to publish dataset: ${error}`);
  }

  return await response.json();
}

async function pushDataToDataset(accessToken: string, workspaceId: string, datasetId: string, tableName: string, rows: any[]) {
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/tables/${tableName}/rows`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ rows })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to push data: ${error}`);
  }

  return { success: true };
}

async function getDatasets(accessToken: string, workspaceId: string) {
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get datasets: ${error}`);
  }

  return await response.json();
}

async function createReport(accessToken: string, workspaceId: string, datasetId: string, reportName: string) {
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: reportName,
      datasetId: datasetId
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create report: ${error}`);
  }

  return await response.json();
}

async function getReports(accessToken: string, workspaceId: string) {
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get reports: ${error}`);
  }

  return await response.json();
}

async function generateEmbedToken(accessToken: string, workspaceId: string, reportId: string, datasetId?: string) {
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/GenerateToken`;

  const body: any = {
    accessLevel: "View"
  };

  if (datasetId) {
    body.datasetId = datasetId;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate embed token: ${error}`);
  }

  return await response.json();
}

async function exportReport(accessToken: string, workspaceId: string, reportId: string, format: string) {
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/ExportTo`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      format: format,
      paginatedReportExportOptions: {
        format: format
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to export report: ${error}`);
  }

  return await response.json();
}

async function getExportStatus(accessToken: string, workspaceId: string, reportId: string, exportId: string) {
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/exports/${exportId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get export status: ${error}`);
  }

  return await response.json();
}

async function refreshDataset(accessToken: string, workspaceId: string, datasetId: string) {
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/refreshes`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh dataset: ${error}`);
  }

  return { success: true, message: "Dataset refresh initiated" };
}

async function getRefreshHistory(accessToken: string, workspaceId: string, datasetId: string) {
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/refreshes`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get refresh history: ${error}`);
  }

  return await response.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const config: PowerBIConfig = body.config;

    if (!config || !config.tenant_id || !config.client_id || !config.client_secret || !config.workspace_id) {
      return new Response(JSON.stringify({ error: "Missing Power BI configuration" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const accessToken = await getAccessToken(config);

    let result: any;

    switch (action) {
      case "publish-dataset":
        result = await publishDataset(accessToken, config.workspace_id, body.datasetName, body.data);
        break;

      case "push-data":
        result = await pushDataToDataset(accessToken, config.workspace_id, body.datasetId, body.tableName || "Data", body.rows);
        break;

      case "get-datasets":
        result = await getDatasets(accessToken, config.workspace_id);
        break;

      case "create-report":
        result = await createReport(accessToken, config.workspace_id, body.datasetId, body.reportName);
        break;

      case "get-reports":
        result = await getReports(accessToken, config.workspace_id);
        break;

      case "generate-embed-token":
        result = await generateEmbedToken(accessToken, config.workspace_id, body.reportId, body.datasetId);
        break;

      case "export-report":
        result = await exportReport(accessToken, config.workspace_id, body.reportId, body.format);
        break;

      case "get-export-status":
        result = await getExportStatus(accessToken, config.workspace_id, body.reportId, body.exportId);
        break;

      case "refresh-dataset":
        result = await refreshDataset(accessToken, config.workspace_id, body.datasetId);
        break;

      case "get-refresh-history":
        result = await getRefreshHistory(accessToken, config.workspace_id, body.datasetId);
        break;

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Power BI Proxy Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
