const { Sidebar, StatCard, Card, Table, BarChart, Badge, Button, Breadcrumb, IconButton, Input, Tabs } = window.CandyStudioDesignSystem_c687d1;

function Icon({ name, size = 16 }) { return <i data-lucide={name} style={{width:size,height:size,display:'inline-flex'}}/>; }
function useLucide() { React.useEffect(() => { window.lucide && window.lucide.createIcons(); }); }
function HomeIcon(){return <Icon name="layout-dashboard"/>;}
function ChartIcon(){return <Icon name="bar-chart-3"/>;}
function UsersIcon(){return <Icon name="users"/>;}
function SettingsIcon(){return <Icon name="settings"/>;}
function SearchIcon(){return <Icon name="search"/>;}
function BellIcon(){return <Icon name="bell"/>;}

function TopBar() {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 28px',borderBottom:'1px solid var(--border)',background:'var(--bg)'}}>
      <Breadcrumb items={['Workspace','Visão geral']}/>
      <div style={{display:'flex',gap:12,alignItems:'center'}}>
        <div style={{width:260}}><Input placeholder="Buscar..." icon={<SearchIcon/>}/></div>
        <IconButton variant="ghost"><BellIcon/></IconButton>
        <div style={{width:36,height:36,borderRadius:'50%',background:'var(--gradient-primary)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13}}>JD</div>
      </div>
    </div>
  );
}

function Overview() {
  const [tab,setTab] = React.useState('30d');
  return (
    <div style={{padding:28,display:'flex',flexDirection:'column',gap:24}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h1 style={{fontSize:'var(--text-3xl)',margin:0,color:'var(--text)'}}>Visão geral</h1>
        <Tabs tabs={[{id:'7d',label:'7 dias'},{id:'30d',label:'30 dias'},{id:'90d',label:'90 dias'}]} active={tab} onChange={setTab}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
        <StatCard label="MRR" value="$48.200" delta="+12,4% vs mês anterior" icon={<ChartIcon/>}/>
        <StatCard label="Clientes ativos" value="1.284" delta="+3,1%" icon={<UsersIcon/>}/>
        <StatCard label="Taxa de churn" value="1,8%" delta="-0,3%" icon={<ChartIcon/>}/>
        <StatCard label="Ticket médio" value="$2.140" delta="-4,2%" deltaTone="error" icon={<ChartIcon/>}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16}}>
        <Card>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
            <div style={{fontWeight:700,fontFamily:'var(--font-display)',color:'var(--text)'}}>Receita</div>
            <Badge tone="success" dot>Em tempo real</Badge>
          </div>
          <BarChart data={[{label:'Jan',value:32},{label:'Feb',value:41},{label:'Mar',value:38},{label:'Apr',value:55},{label:'May',value:49},{label:'Jun',value:62},{label:'Jul',value:71}]} height={200}/>
        </Card>
        <Card>
          <div style={{fontWeight:700,fontFamily:'var(--font-display)',color:'var(--text)',marginBottom:16}}>Mix de planos</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {[['Starter',34,'var(--zinc-300)'],['Growth',48,'var(--color-primary)'],['Scale',18,'var(--color-secondary)']].map(([n,v,c])=>(
              <div key={n}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'var(--text-muted)',marginBottom:4}}><span>{n}</span><span>{v}%</span></div>
                <div style={{height:8,borderRadius:99,background:'var(--surface-2)'}}><div style={{width:v+'%',height:8,borderRadius:99,background:c}}/></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card style={{padding:0}}>
        <div style={{padding:'16px 20px',fontWeight:700,fontFamily:'var(--font-display)',color:'var(--text)',borderBottom:'1px solid var(--border)'}}>Clientes recentes</div>
        <Table columns={['Cliente','Plano','MRR','Status']} rows={[
          ['Acme Inc','Growth','$249',<Badge tone="success" dot>Ativo</Badge>],
          ['Globex','Scale','$499',<Badge tone="success" dot>Ativo</Badge>],
          ['Initech','Starter','$99',<Badge tone="warning">Trial</Badge>],
          ['Northwind','Growth','$249',<Badge tone="error">Em atraso</Badge>],
        ]}/>
      </Card>
    </div>
  );
}

function SaasDashboardApp() {
  useLucide();
  return (
    <div style={{display:'flex',height:'100vh',fontFamily:'var(--font-sans)',background:'var(--surface)'}}>
      <Sidebar logo="Candy Studio" activeId="overview" sections={[
        {title:'Workspace', items:[{id:'overview',label:'Visão geral',icon:<HomeIcon/>},{id:'analytics',label:'Analytics',icon:<ChartIcon/>},{id:'customers',label:'Clientes',icon:<UsersIcon/>}]},
        {title:'Conta', items:[{id:'settings',label:'Configurações',icon:<SettingsIcon/>}]},
      ]} footer={<div style={{fontSize:12,color:'var(--text-muted)'}}>Workspace Acme<br/>Plano Pro</div>}/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'auto'}}>
        <TopBar/>
        <Overview/>
      </div>
    </div>
  );
}
window.SaasDashboardApp = SaasDashboardApp;
