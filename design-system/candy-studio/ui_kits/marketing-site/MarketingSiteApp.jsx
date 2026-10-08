const { Navbar, Hero, PricingCard, FAQItem, Testimonial, Footer, Button, Badge } = window.CandyStudioDesignSystem_c687d1;

function LogoMark() {
  return <span style={{fontWeight:700}}>Candy Studio</span>;
}

function LogosStrip() {
  const names = ['Acme','Fintra','Northwind','Globex','Initech','Vertex'];
  return (
    <div style={{display:'flex',justifyContent:'center',gap:48,padding:'32px 24px',flexWrap:'wrap',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)'}}>
      {names.map(n => <span key={n} style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'var(--text-lg)',color:'var(--zinc-300)'}}>{n}</span>)}
    </div>
  );
}

function ServiceCard({ title, description }) {
  return (
    <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:24,background:'var(--bg)'}}>
      <div style={{width:40,height:40,borderRadius:12,background:'var(--gradient-primary)',marginBottom:16}}/>
      <div style={{fontWeight:700,fontFamily:'var(--font-display)',fontSize:'var(--text-lg)',marginBottom:8,color:'var(--text)'}}>{title}</div>
      <p style={{fontSize:'var(--text-sm)',color:'var(--text-muted)',lineHeight:1.6,margin:0}}>{description}</p>
    </div>
  );
}

function ServicesSection() {
  const services = [
    ['Landing pages e sites','Sites de marketing de alta conversão, construídos para velocidade e clareza.'],
    ['Plataformas SaaS','Produtos full-stack, do onboarding à cobrança.'],
    ['Dashboards e painéis admin','Interfaces densas em dados que continuam legíveis.'],
    ['CRM e sistemas de estoque','Pipelines customizados que se encaixam no jeito que seu time já trabalha.'],
    ['Agentes de IA e automação','Claude, GPT e Gemini conectados a workflows reais.'],
    ['Sistemas financeiros','Ferramentas de relatórios e reconciliação em que você pode confiar.'],
  ];
  return (
    <section style={{padding:'80px 24px',maxWidth:1280,margin:'0 auto'}}>
      <div style={{textAlign:'center',marginBottom:48}}>
        <h2 style={{fontSize:'var(--text-4xl)',margin:'0 0 12px',color:'var(--text)'}}>O que construímos</h2>
        <p style={{color:'var(--text-muted)',fontSize:'var(--text-lg)'}}>Um sistema de design, todas as superfícies que seu produto precisa.</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}}>
        {services.map(([t,d]) => <ServiceCard key={t} title={t} description={d}/>)}
      </div>
    </section>
  );
}

function PricingSection() {
  const [yearly, setYearly] = React.useState(false);
  return (
    <section style={{padding:'80px 24px',maxWidth:1100,margin:'0 auto'}}>
      <div style={{textAlign:'center',marginBottom:16}}>
        <h2 style={{fontSize:'var(--text-4xl)',margin:'0 0 12px',color:'var(--text)'}}>Preços simples e transparentes</h2>
      </div>
      <div style={{display:'flex',justifyContent:'center',gap:10,marginBottom:40}}>
        <Button size="sm" variant={!yearly?'primary':'ghost'} onClick={()=>setYearly(false)}>Mensal</Button>
        <Button size="sm" variant={yearly?'primary':'ghost'} onClick={()=>setYearly(true)}>Anual <Badge tone="success">-20%</Badge></Button>
      </div>
      <div style={{display:'flex',gap:20}}>
        <PricingCard name="Starter" price={yearly?'$79':'$99'} description="Para uma landing page ou MVP" features={['1 projeto ativo','Kit inicial de design system','Suporte por e-mail','Entrega em 2 semanas']}/>
        <PricingCard name="Growth" price={yearly?'$199':'$249'} description="Para startups em crescimento" highlighted features={['3 projetos ativos','Biblioteca de componentes customizada','Suporte prioritário','Reuniões semanais']}/>
        <PricingCard name="Scale" price={yearly?'$399':'$499'} description="Para times com funding, entregando rápido" features={['Projetos ilimitados','Squad dedicado','Integrações com agentes de IA','Suporte no mesmo dia']}/>
      </div>
    </section>
  );
}

function FAQSection() {
  const faqs = [
    ['Qual é o prazo de entrega?','A maioria dos MVPs e landing pages fica pronta em 2–4 semanas, dependendo do escopo.'],
    ['Vocês trabalham com nosso codebase atual?','Sim — nos conectamos a repositórios React/Next.js e os estendemos, ou começamos do zero com nossa própria stack.'],
    ['O que "AI-first" significa na prática?','Usamos desenvolvimento assistido por IA para ir mais rápido, e construímos agentes de IA e automações dentro dos próprios produtos.'],
    ['Vocês também constroem nossas ferramentas internas?','Sim — CRM, estoque e dashboards financeiros fazem parte do que construímos, não são um extra.'],
  ];
  return (
    <section style={{padding:'80px 24px',maxWidth:720,margin:'0 auto'}}>
      <h2 style={{fontSize:'var(--text-4xl)',margin:'0 0 24px',color:'var(--text)',textAlign:'center'}}>Perguntas frequentes</h2>
      {faqs.map(([q,a],i) => <FAQItem key={i} question={q} answer={a} defaultOpen={i===0}/>)}
    </section>
  );
}

function TestimonialsSection() {
  const items = [
    ['A Candy Studio entregou nosso MVP em três semanas — e parecia um produto de uma Series B.','Mia Chen','CEO, Fintra'],
    ['Nosso dashboard finalmente parece tão bom quanto as ferramentas que pagamos.','Diego Alvarez','COO, Northwind Logistics'],
    ['Eles entenderam nossa marca melhor do que nossas últimas três agências juntas.','Priya Nair','Fundadora, Vertex Health'],
  ];
  return (
    <section style={{padding:'80px 24px',maxWidth:1280,margin:'0 auto',background:'var(--surface)'}}>
      <h2 style={{fontSize:'var(--text-4xl)',margin:'0 0 40px',color:'var(--text)',textAlign:'center'}}>Amado por fundadores</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}}>
        {items.map(([q,n,r]) => <Testimonial key={n} quote={q} name={n} role={r}/>)}
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section style={{padding:'96px 24px',textAlign:'center',background:'var(--zinc-950)'}}>
      <h2 style={{fontSize:'var(--text-4xl)',color:'#fff',margin:'0 0 16px'}}>Vamos construir seu próximo produto.</h2>
      <p style={{color:'var(--zinc-400)',fontSize:'var(--text-lg)',margin:'0 0 32px'}}>Agende uma call de 30 minutos — sem pitch deck, só um plano.</p>
      <Button variant="gradient" size="lg">Agendar call</Button>
    </section>
  );
}

function MarketingSiteApp() {
  return (
    <div style={{background:'var(--bg)'}}>
      <Navbar logo={<LogoMark/>} links={[{label:'Produto'},{label:'Preços'},{label:'Portfólio'},{label:'Docs'}]} actions={<><Button variant="ghost" size="sm">Entrar</Button><Button size="sm">Começar</Button></>}/>
      <Hero eyebrow="Agência digital AI-first" title="Lance produtos que convertem." subtitle="UI premium, arquitetura limpa, desenvolvimento assistido por IA e entrega rápida — para startups e times em crescimento." actions={<><Button variant="gradient" size="lg">Agendar call</Button><Button variant="outline" size="lg">Ver portfólio</Button></>}/>
      <LogosStrip/>
      <ServicesSection/>
      <PricingSection/>
      <TestimonialsSection/>
      <FAQSection/>
      <CTASection/>
      <Footer logo={<LogoMark/>} columns={[
        {title:'Produto',links:['Landing Pages','Dashboards','CRM','Agentes de IA']},
        {title:'Empresa',links:['Sobre','Carreiras','Contato']},
        {title:'Recursos',links:['Blog','Docs','Design System']},
      ]} bottom="© 2026 Candy Studio. Todos os direitos reservados."/>
    </div>
  );
}
window.MarketingSiteApp = MarketingSiteApp;
