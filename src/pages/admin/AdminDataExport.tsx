import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Download, Database, Table2, ChevronDown, ChevronRight, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TABLE_NAMES = [
  "ai_usage_logs", "bot_configs", "bot_logs", "bot_posting_queue",
  "cadence_steps", "cadence_templates", "chat_conversations",
  "client_tag_assignments", "client_tags", "clients",
  "employer_verifications", "exclusive_offers", "financing_simulations",
  "interactions", "lead_memory", "lead_timeline_events",
  "message_templates", "messages_sent", "monthly_goals",
  "nps_responses", "offer_claims", "opportunities", "referrals",
  "sms_automations", "sms_logs", "stock_vehicles", "tasks",
  "user_roles", "vehicle_costs", "vehicles"
] as const;

type TableName = typeof TABLE_NAMES[number];

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  udt_name: string;
}

const AdminDataExport = () => {
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [copiedTable, setCopiedTable] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Fetch schema for all tables using a edge function or direct query
  const { data: schemas, isLoading } = useQuery({
    queryKey: ["table-schemas"],
    queryFn: async () => {
      // We'll build the SQL from known schema
      return buildSQLFromSchema();
    },
  });

  const buildSQLFromSchema = (): Record<string, string> => {
    const sqlMap: Record<string, string> = {};

    // Generate CREATE TABLE statements based on known schema
    sqlMap["ai_usage_logs"] = `CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  tokens_used integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["bot_configs"] = `CREATE TABLE IF NOT EXISTS public.bot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_name text NOT NULL,
  platform text NOT NULL DEFAULT 'facebook',
  bot_id text,
  bot_type text DEFAULT 'messaging',
  is_active boolean NOT NULL DEFAULT false,
  max_per_cycle integer NOT NULL DEFAULT 5,
  delay_seconds integer NOT NULL DEFAULT 30,
  dry_mode boolean NOT NULL DEFAULT false,
  leads_captured_today integer NOT NULL DEFAULT 0,
  last_reset_at date DEFAULT CURRENT_DATE,
  schedule_time time,
  last_run_at timestamptz,
  last_heartbeat_at timestamptz,
  facebook_account text,
  seller_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["bot_logs"] = `CREATE TABLE IF NOT EXISTS public.bot_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_config_id uuid NOT NULL REFERENCES public.bot_configs(id),
  platform text NOT NULL DEFAULT 'facebook',
  event_type text NOT NULL DEFAULT 'message',
  contact_name text,
  message_in text,
  message_out text,
  client_id uuid REFERENCES public.clients(id),
  lead_created boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["bot_posting_queue"] = `CREATE TABLE IF NOT EXISTS public.bot_posting_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.stock_vehicles(id),
  local_bot_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz DEFAULT now(),
  posted_at timestamptz,
  error_msg text,
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["cadence_templates"] = `CREATE TABLE IF NOT EXISTS public.cadence_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_stage text NOT NULL,
  step_number integer NOT NULL,
  delay_days integer NOT NULL DEFAULT 0,
  action_type text NOT NULL DEFAULT 'follow_up',
  task_reason text NOT NULL,
  suggested_message text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["cadence_steps"] = `CREATE TABLE IF NOT EXISTS public.cadence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  template_id uuid NOT NULL REFERENCES public.cadence_templates(id),
  pipeline_stage text NOT NULL,
  step_number integer NOT NULL,
  scheduled_for timestamptz NOT NULL,
  completed_at timestamptz,
  skipped boolean NOT NULL DEFAULT false,
  task_id uuid REFERENCES public.tasks(id),
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["client_tags"] = `CREATE TABLE IF NOT EXISTS public.client_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT 'hsl(0 72% 51%)',
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["client_tag_assignments"] = `CREATE TABLE IF NOT EXISTS public.client_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  tag_id uuid NOT NULL REFERENCES public.client_tags(id),
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["chat_conversations"] = `CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  client_id uuid REFERENCES public.clients(id),
  transferred_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["clients"] = `-- ENUMS (criar antes da tabela clients)
CREATE TYPE public.client_status AS ENUM ('lead', 'active', 'inactive', 'lost');
CREATE TYPE public.lead_temperature AS ENUM ('hot', 'warm', 'cold', 'frozen');
CREATE TYPE public.pipeline_stage AS ENUM ('new', 'contacted', 'interested', 'negotiating', 'closed_won', 'closed_lost', 'attending', 'thinking', 'waiting_response', 'scheduled', 'proposal_sent', 'financing_analysis', 'approved', 'rejected', 'reactivation', 'first_contact', 'qualification', 'proposal', 'negotiation', 'closing');
CREATE TYPE public.client_substatus AS ENUM ('active', 'scheduled', 'waiting_client', 'thinking', 'no_response', 'docs_pending');
CREATE TYPE public.client_promise_status AS ENUM ('pending', 'overdue', 'fulfilled', 'broken');
CREATE TYPE public.credit_status AS ENUM ('pending', 'submitted', 'approved', 'denied', 'renegotiating');
CREATE TYPE public.deal_type AS ENUM ('cash', 'financing_down', 'financing_full', 'trade_financing', 'trade_only');
CREATE TYPE public.docs_status AS ENUM ('incomplete', 'collecting', 'complete');
CREATE TYPE public.loss_reason AS ENUM ('price_too_high', 'no_down_payment', 'installment_too_high', 'credit_denied', 'bought_elsewhere', 'better_offer', 'trade_value_disagreement', 'ghosted', 'postponed', 'changed_mind', 'vehicle_sold', 'slow_response', 'other');
CREATE TYPE public.next_action_type AS ENUM ('call', 'send_proposal', 'send_message', 'collect_docs', 'follow_up', 'schedule_visit', 'submit_credit', 'wait_client', 'close_deal', 'send_content');
CREATE TYPE public.objection_type AS ENUM ('price', 'down_payment', 'installment', 'credit', 'trust', 'comparison', 'trade_undervalued', 'indecision', 'timing', 'none');

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  city text,
  source text DEFAULT 'funnel',
  interest text,
  budget_range text,
  notes text,
  status client_status NOT NULL DEFAULT 'lead',
  substatus client_substatus DEFAULT 'active',
  temperature lead_temperature NOT NULL DEFAULT 'warm',
  pipeline_stage pipeline_stage NOT NULL DEFAULT 'new',
  lead_score integer NOT NULL DEFAULT 0,
  arsenal_score integer NOT NULL DEFAULT 0,
  priority_score integer DEFAULT 0,
  churn_risk integer DEFAULT 0,
  has_trade_in boolean DEFAULT false,
  has_down_payment boolean DEFAULT false,
  has_clean_credit boolean DEFAULT false,
  down_payment_amount numeric,
  deal_value numeric,
  deal_type deal_type,
  estimated_margin numeric,
  approval_probability integer,
  salary numeric,
  gross_income numeric,
  payment_type text DEFAULT 'financing',
  financing_status text DEFAULT 'incomplete',
  financing_docs jsonb DEFAULT '{"cnh": false, "pay_stub": false, "reference": false, "proof_of_residence": false}'::jsonb,
  credit_status credit_status,
  docs_status docs_status,
  objection_type objection_type,
  loss_reason loss_reason,
  loss_notes text,
  next_action text,
  next_action_type next_action_type,
  next_action_due timestamptz,
  client_promise text,
  client_promise_status client_promise_status,
  client_promise_due timestamptz,
  queue_reason text,
  response_time_hours integer,
  last_contact_at timestamptz,
  referred_by uuid REFERENCES public.clients(id),
  vehicle_id uuid,
  funnel_data jsonb DEFAULT '{}'::jsonb,
  -- Dados pessoais
  cpf text,
  rg text,
  rg_issuer text,
  birthdate date,
  birth_city text,
  gender text,
  marital_status text,
  mother_name text,
  father_name text,
  education_level text,
  dependents integer DEFAULT 0,
  cnh_number text,
  cnh_category text,
  -- Endereço
  address_cep text,
  address_street text,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_state text,
  housing_type text,
  residence_time text,
  -- Emprego
  employer text,
  employer_cnpj text,
  employer_phone text,
  employer_address text,
  employer_cep text,
  employment_time text,
  position text,
  profession text,
  -- Referências
  reference_name text,
  reference_phone text,
  reference_relation text,
  reference_name_2 text,
  reference_phone_2 text,
  reference_relation_2 text,
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["employer_verifications"] = `CREATE TABLE IF NOT EXISTS public.employer_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  employer_name text,
  cnpj text,
  cnpj_validated boolean DEFAULT false,
  verified boolean DEFAULT false,
  reliability_score integer,
  company_name text,
  trading_name text,
  sector text,
  size text,
  status text,
  location text,
  address text,
  legal_nature text,
  founded_year text,
  share_capital numeric,
  source text,
  risk_flags jsonb DEFAULT '[]'::jsonb,
  positive_flags jsonb DEFAULT '[]'::jsonb,
  extracted_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["exclusive_offers"] = `CREATE TABLE IF NOT EXISTS public.exclusive_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  target_segment text NOT NULL DEFAULT 'closed_won',
  discount_percent integer,
  valid_until date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["financing_simulations"] = `CREATE TABLE IF NOT EXISTS public.financing_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id),
  client_name text,
  client_phone text,
  moto_value numeric NOT NULL,
  down_payment numeric NOT NULL DEFAULT 0,
  financed_amount numeric NOT NULL,
  months integer NOT NULL,
  interest_rate numeric NOT NULL DEFAULT 0.019,
  monthly_payment numeric NOT NULL,
  total_interest numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'simulator',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["interactions"] = `CREATE TYPE public.interaction_type AS ENUM ('whatsapp', 'call', 'visit', 'system', 'email', 'sms');

CREATE TABLE IF NOT EXISTS public.interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  type interaction_type NOT NULL DEFAULT 'system',
  content text NOT NULL,
  created_by text DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["lead_memory"] = `CREATE TABLE IF NOT EXISTS public.lead_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id),
  summary text,
  interests text[] DEFAULT '{}',
  objections text[] DEFAULT '{}',
  decisions text[] DEFAULT '{}',
  behavior_patterns text[] DEFAULT '{}',
  ai_tags text[] DEFAULT '{}',
  lead_temperature_ai text,
  recommended_action text,
  recommended_message text,
  last_analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["lead_timeline_events"] = `CREATE TYPE public.timeline_event_type AS ENUM ('message_sent', 'message_received', 'whatsapp_paste', 'status_change', 'proposal_sent', 'document_uploaded', 'ai_analysis', 'inactivity_detected', 'note', 'call', 'visit');

CREATE TABLE IF NOT EXISTS public.lead_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  event_type timeline_event_type NOT NULL,
  content text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["message_templates"] = `CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  category text NOT NULL,
  emoji text DEFAULT '💬',
  variables text[] DEFAULT '{}',
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["messages_sent"] = `CREATE TABLE IF NOT EXISTS public.messages_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  template_id uuid REFERENCES public.message_templates(id),
  channel text NOT NULL DEFAULT 'whatsapp',
  message_content text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["monthly_goals"] = `CREATE TABLE IF NOT EXISTS public.monthly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL,
  year integer NOT NULL,
  target_sales integer NOT NULL DEFAULT 10,
  target_leads integer NOT NULL DEFAULT 50,
  target_contacts integer NOT NULL DEFAULT 100,
  target_revenue numeric NOT NULL DEFAULT 0,
  target_ltv numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["nps_responses"] = `CREATE TABLE IF NOT EXISTS public.nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  score integer NOT NULL,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["offer_claims"] = `CREATE TABLE IF NOT EXISTS public.offer_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  offer_id uuid NOT NULL REFERENCES public.exclusive_offers(id),
  claimed_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["opportunities"] = `CREATE TYPE public.opportunity_type AS ENUM ('trade', 'refinance', 'upsell', 'reactivation', 'birthday', 'milestone');

CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  type opportunity_type NOT NULL,
  title text NOT NULL,
  message text,
  priority integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'pending',
  acted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["referrals"] = `CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.clients(id),
  referred_client_id uuid REFERENCES public.clients(id),
  referred_name text,
  referred_phone text,
  reward_amount numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["sms_automations"] = `CREATE TABLE IF NOT EXISTS public.sms_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL,
  target_segment text NOT NULL DEFAULT 'all',
  message_template text NOT NULL,
  days_inactive integer NOT NULL DEFAULT 1,
  max_sends_per_day integer NOT NULL DEFAULT 50,
  sends_today integer NOT NULL DEFAULT 0,
  last_reset_at date DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);`;

    sqlMap["sms_logs"] = `CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  phone text NOT NULL,
  message text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'manual',
  template_key text,
  status text NOT NULL DEFAULT 'pending',
  smsdev_id text,
  error_message text,
  sent_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now()
);`;

    sqlMap["stock_vehicles"] = `CREATE TABLE IF NOT EXISTS public.stock_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  model text NOT NULL,
  year integer,
  price numeric NOT NULL,
  km integer DEFAULT 0,
  color text,
  fuel text DEFAULT 'Flex',
  condition text NOT NULL DEFAULT 'used',
  status text NOT NULL DEFAULT 'available',
  description text,
  features text[],
  image_url text,
  photos text[] DEFAULT '{}',
  plate text,
  chassis text,
  renavam text,
  purchase_price numeric DEFAULT 0,
  selling_price numeric,
  purchase_date date DEFAULT CURRENT_DATE,
  documents_cost numeric DEFAULT 0,
  total_costs numeric DEFAULT 0,
  seller_name text,
  seller_phone text,
  local_bot_id text,
  fipe_value numeric,
  fipe_brand_code text,
  fipe_model_code text,
  fipe_year_code text,
  fipe_vehicle_type text DEFAULT 'carros',
  fipe_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["tasks"] = `CREATE TYPE public.task_type AS ENUM ('opportunity', 'relationship', 'value', 'follow_up');

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  type task_type NOT NULL DEFAULT 'follow_up',
  reason text NOT NULL,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  scheduled_time time,
  status text NOT NULL DEFAULT 'pending',
  priority integer DEFAULT 5,
  source text DEFAULT 'manual',
  notes text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);`;

    sqlMap["user_roles"] = `CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);`;

    sqlMap["vehicle_costs"] = `CREATE TABLE IF NOT EXISTS public.vehicle_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.stock_vehicles(id),
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'other',
  date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);`;

    sqlMap["vehicles"] = `CREATE TYPE public.vehicle_status AS ENUM ('current', 'sold', 'traded');

CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  brand text NOT NULL,
  model text NOT NULL,
  year integer,
  km integer,
  estimated_value numeric,
  is_financed boolean DEFAULT false,
  monthly_payment numeric,
  installments_total integer DEFAULT 0,
  installments_paid integer DEFAULT 0,
  status vehicle_status NOT NULL DEFAULT 'current',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);`;

    return sqlMap;
  };

  const getAllSQL = () => {
    if (!schemas) return "";
    const order = [
      "clients", "stock_vehicles", "vehicles", "tasks",
      "interactions", "lead_memory", "lead_timeline_events",
      "cadence_templates", "cadence_steps",
      "bot_configs", "bot_logs", "bot_posting_queue",
      "chat_conversations", "client_tags", "client_tag_assignments",
      "employer_verifications", "exclusive_offers", "offer_claims",
      "financing_simulations", "message_templates", "messages_sent",
      "monthly_goals", "nps_responses", "opportunities", "referrals",
      "sms_automations", "sms_logs", "vehicle_costs",
      "ai_usage_logs", "user_roles"
    ];
    return order
      .filter(t => schemas[t])
      .map(t => `-- ========== ${t.toUpperCase()} ==========\n${schemas[t]}`)
      .join("\n\n");
  };

  const copyToClipboard = async (text: string, table?: string) => {
    await navigator.clipboard.writeText(text);
    if (table) {
      setCopiedTable(table);
      setTimeout(() => setCopiedTable(null), 2000);
    } else {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
    toast.success("SQL copiado!");
  };

  const downloadSQL = () => {
    const sql = getAllSQL();
    const blob = new Blob([sql], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "arsenal_crm_schema.sql";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo SQL baixado!");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            Exportar Schema SQL
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Copie o SQL das tabelas para migrar o banco de dados
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => copyToClipboard(getAllSQL())} variant="outline">
            {copiedAll ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copiedAll ? "Copiado!" : "Copiar Tudo"}
          </Button>
          <Button onClick={downloadSQL}>
            <Download className="w-4 h-4 mr-2" />
            Baixar .sql
          </Button>
        </div>
      </div>

      {/* Full SQL preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="w-4 h-4" />
            SQL Completo — {TABLE_NAMES.length} tabelas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            readOnly
            value={getAllSQL()}
            className="font-mono text-xs min-h-[300px] bg-muted/50"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
        </CardContent>
      </Card>

      {/* Individual tables */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Tabelas Individuais</h2>
        {schemas && TABLE_NAMES.map((table) => (
          <Card key={table} className="overflow-hidden">
            <button
              onClick={() => setExpandedTable(expandedTable === table ? null : table)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Table2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono text-sm font-medium">{table}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {(schemas[table]?.split("\n").length || 0)} linhas
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {expandedTable === table && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(schemas[table] || "", table);
                    }}
                  >
                    {copiedTable === table ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                )}
                {expandedTable === table ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>
            {expandedTable === table && (
              <CardContent className="pt-0 pb-3 px-4">
                <Textarea
                  readOnly
                  value={schemas[table] || ""}
                  className="font-mono text-xs min-h-[120px] bg-muted/50"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDataExport;
