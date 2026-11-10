import { getAccessToken } from './firebase';

export interface WorkspaceSummaryItem {
  service: string;
  title: string;
  subtitle: string;
  link?: string;
}

async function fetchWorkspaceJson(url: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('NEEDS_AUTH');
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Workspace API (${res.status}): ${errText.slice(0, 160)}`);
  }
  return res.json();
}

export async function fetchDriveFiles(): Promise<WorkspaceSummaryItem[]> {
  const data = await fetchWorkspaceJson(
    'https://www.googleapis.com/drive/v3/files?pageSize=6&fields=files(id,name,mimeType,webViewLink)'
  );
  return (data.files || []).map((f: Record<string, string>) => ({
    service: 'Google Drive',
    title: f.name || 'Untitled File',
    subtitle: f.mimeType || 'Drive asset',
    link: f.webViewLink,
  }));
}

export async function fetchCalendarEvents(): Promise<WorkspaceSummaryItem[]> {
  const now = new Date().toISOString();
  const data = await fetchWorkspaceJson(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(now)}`
  );
  return (data.items || []).map((ev: Record<string, any>) => ({
    service: 'Google Calendar',
    title: ev.summary || 'Scheduled Broadcast',
    subtitle: ev.start?.dateTime || ev.start?.date || 'Upcoming',
    link: ev.htmlLink,
  }));
}

export async function fetchGmailMessages(): Promise<WorkspaceSummaryItem[]> {
  const list = await fetchWorkspaceJson(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=4'
  );
  const messages = list.messages || [];
  const items: WorkspaceSummaryItem[] = [];
  for (const msg of messages.slice(0, 4)) {
    const detail = await fetchWorkspaceJson(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`
    );
    const headers: Array<{ name: string; value: string }> =
      detail.payload?.headers || [];
    const subject =
      headers.find((h) => h.name === 'Subject')?.value || '(No Subject)';
    const from = headers.find((h) => h.name === 'From')?.value || 'Sender';
    items.push({
      service: 'Gmail',
      title: subject,
      subtitle: from,
    });
  }
  return items;
}

export async function fetchTasksList(): Promise<WorkspaceSummaryItem[]> {
  const lists = await fetchWorkspaceJson(
    'https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=1'
  );
  const firstListId = lists.items?.[0]?.id;
  if (!firstListId) return [];
  const tasks = await fetchWorkspaceJson(
    `https://tasks.googleapis.com/tasks/v1/lists/${firstListId}/tasks?maxResults=5`
  );
  return (tasks.items || []).map((t: Record<string, string>) => ({
    service: 'Google Tasks',
    title: t.title || 'Production Task',
    subtitle: `Status: ${t.status || 'needsAction'}`,
  }));
}

export async function fetchContactsList(): Promise<WorkspaceSummaryItem[]> {
  const data = await fetchWorkspaceJson(
    'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses&pageSize=5'
  );
  return (data.connections || []).map((c: Record<string, any>) => ({
    service: 'Google Contacts',
    title: c.names?.[0]?.displayName || 'Contact',
    subtitle: c.emailAddresses?.[0]?.value || 'No email',
  }));
}

export async function fetchChatSpaces(): Promise<WorkspaceSummaryItem[]> {
  const data = await fetchWorkspaceJson(
    'https://chat.googleapis.com/v1/spaces?pageSize=5'
  );
  return (data.spaces || []).map((s: Record<string, string>) => ({
    service: 'Google Chat',
    title: s.displayName || s.name || 'Production Space',
    subtitle: `Type: ${s.spaceType || 'SPACE'}`,
  }));
}

export async function fetchSheetsMetadata(spreadsheetId: string): Promise<WorkspaceSummaryItem[]> {
  const data = await fetchWorkspaceJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`
  );
  return [
    {
      service: 'Google Sheets',
      title: data.properties?.title || 'Spreadsheet',
      subtitle: `${(data.sheets || []).length} sheet tab(s) loaded`,
      link: data.spreadsheetUrl,
    },
  ];
}

export async function fetchDocMetadata(documentId: string): Promise<WorkspaceSummaryItem[]> {
  const data = await fetchWorkspaceJson(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`
  );
  return [
    {
      service: 'Google Docs',
      title: data.title || 'Production Script',
      subtitle: `Revision ID: ${String(data.revisionId || '').slice(0, 12)}`,
    },
  ];
}

export async function fetchSlidesMetadata(presentationId: string): Promise<WorkspaceSummaryItem[]> {
  const data = await fetchWorkspaceJson(
    `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(presentationId)}`
  );
  return [
    {
      service: 'Google Slides',
      title: data.title || 'Pitch Deck',
      subtitle: `${(data.slides || []).length} slide(s)`,
    },
  ];
}

export async function fetchFormMetadata(formId: string): Promise<WorkspaceSummaryItem[]> {
  const data = await fetchWorkspaceJson(
    `https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}`
  );
  return [
    {
      service: 'Google Forms',
      title: data.info?.title || 'Audience Feedback Form',
      subtitle: data.responderUri || 'Form active',
      link: data.responderUri,
    },
  ];
}

export async function fetchMeetSpace(spaceName: string): Promise<WorkspaceSummaryItem[]> {
  const data = await fetchWorkspaceJson(
    `https://meet.googleapis.com/v2/spaces/${encodeURIComponent(spaceName)}`
  );
  return [
    {
      service: 'Google Meet',
      title: data.meetingCode || 'Live Studio Room',
      subtitle: data.meetingUri || 'Active Meet Space',
      link: data.meetingUri,
    },
  ];
}

// Mutating operations (MUST only be called after explicit user confirmation modal in UI)
export async function createCalendarBroadcastEvent(
  summary: string,
  description: string
): Promise<WorkspaceSummaryItem> {
  const start = new Date(Date.now() + 3600 * 1000).toISOString();
  const end = new Date(Date.now() + 7200 * 1000).toISOString();
  const data = await fetchWorkspaceJson(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      body: JSON.stringify({
        summary,
        description,
        start: { dateTime: start },
        end: { dateTime: end },
      }),
    }
  );
  return {
    service: 'Google Calendar',
    title: data.summary || summary,
    subtitle: 'Created Live Broadcast Event',
    link: data.htmlLink,
  };
}

export async function saveManifestToDrive(
  fileName: string,
  jsonContent: string
): Promise<WorkspaceSummaryItem> {
  const token = await getAccessToken();
  if (!token) throw new Error('NEEDS_AUTH');

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append(
    'file',
    new Blob([jsonContent], { type: 'application/json' })
  );

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );
  if (!res.ok) {
    throw new Error(`Drive upload failed: ${res.statusText}`);
  }
  const data = await res.json();
  return {
    service: 'Google Drive',
    title: data.name || fileName,
    subtitle: 'Exported 32K Stream Manifest',
    link: data.webViewLink,
  };
}
