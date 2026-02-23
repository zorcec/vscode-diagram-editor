import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TasksApp } from './TasksApp';
import './tasks.css';
import type { TasksDocument } from '../../types/TasksDocument';
import type { TasksHostMessage } from '../../messages/tasksProtocol';
import { postMessageToHost } from './vsCodeBridge';

function Root() {
  const [doc, setDoc] = useState<TasksDocument | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent<TasksHostMessage>) => {
      if (event.data.type === 'TASKS_DOCUMENT_UPDATED') {
        setDoc(event.data.doc);
      }
    };
    window.addEventListener('message', handler);
    postMessageToHost({ type: 'TASKS_WEBVIEW_READY' });
    return () => window.removeEventListener('message', handler);
  }, []);

  if (!doc) {
    return <div className="tasks-loading">Loading tasks...</div>;
  }

  return <TasksApp doc={doc} />;
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<Root />);
}
