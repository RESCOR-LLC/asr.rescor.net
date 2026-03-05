const API_BASE_URL = import.meta.env.VITE_ASR_API_BASE_URL || '';

function buildUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export async function getGraphFromApi() {
  try {
    const response = await fetch(buildUrl('/asr/graph'));

    if (response.status === 404) {
      return { ok: false, notFound: true, graph: null };
    }

    if (!response.ok) {
      return { ok: false, notFound: false, graph: null };
    }

    const payload = await response.json();
    return { ok: true, notFound: false, graph: payload?.data?.graph ?? null };
  } catch {
    return { ok: false, notFound: false, graph: null };
  }
}

export async function putGraphToApi(graph) {
  try {
    const response = await fetch(buildUrl('/asr/graph'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ graph })
    });

    return response.ok;
  } catch {
    return false;
  }
}
