import React, { createContext, useContext, useMemo, useReducer } from "react";
import { useAsyncEffect } from "@/utils/useAsyncEffect";
import { useMemoizedFn } from "@/utils/useMemoizedFn";
import {
  getAll as getAllTemplates,
  insert as insertTemplate,
  update as updateTemplateRow,
  remove as removeTemplate,
} from "@/db/transferTemplates";
import type { TransferTemplate, TransferTemplateInput } from "@/types";

interface State {
  templates: TransferTemplate[];
  isLoading: boolean;
}

type Action =
  | { type: "LOAD"; payload: TransferTemplate[] }
  | { type: "ADD"; payload: TransferTemplate }
  | { type: "UPDATE"; payload: TransferTemplate }
  | { type: "REMOVE"; payload: string };

// By name, so "Load 50" lists before "Load 100" and case never splits them.
function sortTemplates(templates: TransferTemplate[]): TransferTemplate[] {
  return [...templates].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD":
      return { templates: sortTemplates(action.payload), isLoading: false };
    case "ADD":
      return { ...state, templates: sortTemplates([...state.templates, action.payload]) };
    case "UPDATE":
      return {
        ...state,
        templates: sortTemplates(state.templates.map((t) => (t.id === action.payload.id ? action.payload : t))),
      };
    case "REMOVE":
      return { ...state, templates: state.templates.filter((t) => t.id !== action.payload) };
    default:
      return state;
  }
}

interface TransferTemplateContextValue {
  templates: TransferTemplate[];
  isLoading: boolean;
  addTemplate: (input: TransferTemplateInput) => Promise<TransferTemplate>;
  updateTemplate: (id: string, input: TransferTemplateInput) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

const TransferTemplateContext = createContext<TransferTemplateContextValue | null>(null);

export function TransferTemplateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { templates: [], isLoading: true });

  const reload = useMemoizedFn(async () => {
    const templates = await getAllTemplates();
    dispatch({ type: "LOAD", payload: templates });
  });

  useAsyncEffect(async function* () {
    try {
      const templates = await getAllTemplates();
      yield;
      dispatch({ type: "LOAD", payload: templates });
    } catch (e) {
      console.error(e);
      yield;
      dispatch({ type: "LOAD", payload: [] });
    }
  }, []);

  const addTemplate = useMemoizedFn(async (input: TransferTemplateInput) => {
    const template = await insertTemplate(input);
    dispatch({ type: "ADD", payload: template });
    return template;
  });

  const updateTemplate = useMemoizedFn(async (id: string, input: TransferTemplateInput) => {
    const existing = state.templates.find((t) => t.id === id);
    if (!existing) {
      throw new Error("Template not found");
    }
    await updateTemplateRow(id, input);
    dispatch({ type: "UPDATE", payload: { ...input, id, createdAt: existing.createdAt } });
  });

  const deleteTemplate = useMemoizedFn(async (id: string) => {
    await removeTemplate(id);
    dispatch({ type: "REMOVE", payload: id });
  });

  const value = useMemo(
    () => ({
      templates: state.templates,
      isLoading: state.isLoading,
      addTemplate,
      updateTemplate,
      deleteTemplate,
      reload,
    }),
    [state]
  );

  return <TransferTemplateContext.Provider value={value}>{children}</TransferTemplateContext.Provider>;
}

export function useTransferTemplates() {
  const ctx = useContext(TransferTemplateContext);
  if (!ctx) {
    throw new Error("useTransferTemplates must be used within TransferTemplateProvider");
  }
  return ctx;
}
