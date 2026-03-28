import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// ============ CLIENTS ============
export const useClients = (filters?: { status?: string; temperature?: string; pipeline_stage?: string }) => {
  return useQuery({
    queryKey: ["clients", filters],
    queryFn: async () => {
      let query = supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (filters?.status) query = query.eq("status", filters.status as any);
      if (filters?.temperature) query = query.eq("temperature", filters.temperature as any);
      if (filters?.pipeline_stage) query = query.eq("pipeline_stage", filters.pipeline_stage as any);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

export const useClient = (id: string) => {
  return useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (client: TablesInsert<"clients">) => {
      const { data, error } = await supabase.from("clients").insert(client).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
};

export const useUpdateClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"clients"> & { id: string }) => {
      const { data, error } = await supabase.from("clients").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", vars.id] });
    },
  });
};

// ============ VEHICLES ============
export const useClientVehicles = (clientId: string) => {
  return useQuery({
    queryKey: ["vehicles", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
};

// ============ INTERACTIONS ============
export const useClientInteractions = (clientId: string) => {
  return useQuery({
    queryKey: ["interactions", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("interactions").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
};

export const useCreateInteraction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (interaction: TablesInsert<"interactions">) => {
      const { data, error } = await supabase.from("interactions").insert(interaction).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["interactions", vars.client_id] }),
  });
};

// ============ TASKS ============
export const useTasks = (filters?: { status?: string; due_date?: string }) => {
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: async () => {
      let query = supabase.from("tasks").select("*, clients(name, phone)").order("due_date", { ascending: true });
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.due_date) query = query.eq("due_date", filters.due_date);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

export const useUpdateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<TablesUpdate<"tasks">>) => {
      const { data, error } = await supabase.from("tasks").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
};

// ============ OPPORTUNITIES ============
export const useOpportunities = (filters?: { status?: string }) => {
  return useQuery({
    queryKey: ["opportunities", filters],
    queryFn: async () => {
      let query = supabase.from("opportunities").select("*, clients(name, phone)").order("priority", { ascending: false });
      if (filters?.status) query = query.eq("status", filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

// ============ MESSAGE TEMPLATES ============
export const useMessageTemplates = (category?: string) => {
  return useQuery({
    queryKey: ["message_templates", category],
    queryFn: async () => {
      let query = supabase.from("message_templates").select("*").order("usage_count", { ascending: false });
      if (category && category !== "all") query = query.eq("category", category);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

// ============ STATS ============
export const useDashboardStats = () => {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [clients, hotLeads, activeTasks, opportunities] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("temperature", "hot"),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return {
        totalLeads: clients.count || 0,
        hotLeads: hotLeads.count || 0,
        activeClients: activeTasks.count || 0,
        opportunities: opportunities.count || 0,
      };
    },
  });
};
