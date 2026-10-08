const { Sidebar, KanbanCard, Button, Badge, Breadcrumb, IconButton, Input, StatCard } = window.CandyStudioDesignSystem_c687d1;

function Icon({ name, size = 16 }) { return <i data-lucide={name} style={{width:size,height:size,display:'inline-flex'}}/>; }
function useLucide() { React.useEffect(() => { window.lucide && window.lucide.createIcons(); }); }
function HomeIcon(){return <Icon name="layout-dashboard"/>;}
function DealsIcon(){return <Icon name="git-branch"/>;}
function ContactsIcon(){return <Icon name="users"/>;}
function SearchIcon(){return <Icon name="search"/>;}
function PlusIcon(){return <Icon name="plus"/>;}

const COLUMNS = [
  { id: 'lead', title: 'Lead', tone: 'primary', deals: [
    { title: 'Northwind Logistics — Onboarding', tag: 'Novo', assignee: 'AS', due: 'Até seg' },
    { title: 'Vertex Health — Revamp do site', tag: 'Novo', assignee: 'JD', due: 'Até qua' },
  ]},
  { id: 'qualified', title: 'Qualificado', tone: 'primary', deals: [
    { title: 'Fintra — MVP de dashboard', tag: 'Qualificado', assignee: 'MC', due: 'Até sex' },
  ]},
  { id: 'negotiation', title: 'Negociação', tone: 'warning', deals: [
    { title: 'Acme Corp — Renovação', tag: 'Negociação', assignee: 'JD', due: 'Até sex' },
    { title: 'Globex — Construção de CRM', tag: 'Negociação', assignee: 'AS', due: 'Até seg' },
  ]},
  { id: 'won', title: 'Ganho', tone: 'success', deals: [
    { title: 'Initech — Landing page', tag: 'Ganho', assignee: 'MC', due: 'Fechado' },
  ]},
];

function TopBar() {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 28px',borderBottom:'1px solid var(--border)',background:'var(--bg)'}}>
      <Breadcrumb items={['CRM','Pipeline']}/>
      <div style={{display:'flex',gap:12,alignItems:'center'}}>
        <div style={{width:240}}><Input placeholder="Buscar negócios..." icon={<SearchIcon/>}/></div>
        <Button size="sm" icon={<PlusIcon/>}>Novo negócio</Button>
      </div>
    </div>
  );
}

function Column({ col }) {
  return (
    <div style={{width:280,flexShrink:0,display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 4px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontWeight:700,fontSize:'var(--text-sm)',color:'var(--text)'}}>{col.title}</span>
          <Badge tone="neutral">{col.deals.length}</Badge>
        </div>
        <IconButton variant="ghost" size="sm"><PlusIcon/></IconButton>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {col.deals.map((d,i) => <KanbanCard key={i} title={d.title} tag={d.tag} tagTone={col.tone} assignee={d.assignee} due={d.due}/>)}
      </div>
    </div>
  );
}

function CrmPipelineApp() {
  useLucide();
  return (
    <div style={{display:'flex',height:'100vh',fontFamily:'var(--font-sans)',background:'var(--surface)'}}>
      <Sidebar logo="Candy Studio" activeId="pipeline" sections={[
        {title:'CRM', items:[{id:'overview',label:'Visão geral',icon:<HomeIcon/>},{id:'pipeline',label:'Pipeline',icon:<DealsIcon/>},{id:'contacts',label:'Contatos',icon:<ContactsIcon/>}]},
      ]} footer={<div style={{fontSize:12,color:'var(--text-muted)'}}>Workspace Acme<br/>Plano Pro</div>}/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'auto'}}>
        <TopBar/>
        <div style={{padding:28,display:'flex',flexDirection:'column',gap:20}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
            <StatCard label="Valor do pipeline aberto" value="$186.400" delta="+8,2% neste trimestre"/>
            <StatCard label="Negócios em negociação" value="6" delta="+2"/>
            <StatCard label="Taxa de conversão" value="42%" delta="-3,1%" deltaTone="error"/>
          </div>
          <div style={{display:'flex',gap:16,overflowX:'auto',paddingBottom:8}}>
            {COLUMNS.map(c => <Column key={c.id} col={c}/>)}
          </div>
        </div>
      </div>
    </div>
  );
}
window.CrmPipelineApp = CrmPipelineApp;
