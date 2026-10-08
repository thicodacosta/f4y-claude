/* @ds-bundle: {"format":4,"namespace":"CandyStudioDesignSystem_c687d1","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"BarChart","sourcePath":"components/data/BarChart.jsx"},{"name":"Calendar","sourcePath":"components/data/Calendar.jsx"},{"name":"Card","sourcePath":"components/data/Card.jsx"},{"name":"KanbanCard","sourcePath":"components/data/KanbanCard.jsx"},{"name":"StatCard","sourcePath":"components/data/StatCard.jsx"},{"name":"Table","sourcePath":"components/data/Table.jsx"},{"name":"Badge","sourcePath":"components/feedback/Badge.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Tag","sourcePath":"components/feedback/Tag.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"FormField","sourcePath":"components/forms/FormField.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"FAQItem","sourcePath":"components/marketing/FAQItem.jsx"},{"name":"Hero","sourcePath":"components/marketing/Hero.jsx"},{"name":"PricingCard","sourcePath":"components/marketing/PricingCard.jsx"},{"name":"Testimonial","sourcePath":"components/marketing/Testimonial.jsx"},{"name":"TimelineItem","sourcePath":"components/marketing/TimelineItem.jsx"},{"name":"Breadcrumb","sourcePath":"components/navigation/Breadcrumb.jsx"},{"name":"Footer","sourcePath":"components/navigation/Footer.jsx"},{"name":"Navbar","sourcePath":"components/navigation/Navbar.jsx"},{"name":"Pagination","sourcePath":"components/navigation/Pagination.jsx"},{"name":"Sidebar","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/core/Button.jsx":"d949c1d8971f","components/core/IconButton.jsx":"387ff331c414","components/data/BarChart.jsx":"b13a3ddb6a40","components/data/Calendar.jsx":"fdcc6467e780","components/data/Card.jsx":"0c6f5312ee8e","components/data/KanbanCard.jsx":"e9c0c62678de","components/data/StatCard.jsx":"d24182e91370","components/data/Table.jsx":"1f2f5a3b2050","components/feedback/Badge.jsx":"db93aa4a531f","components/feedback/Dialog.jsx":"db006e375d18","components/feedback/Tag.jsx":"b0001c8ad883","components/feedback/Toast.jsx":"7d9512962654","components/feedback/Tooltip.jsx":"5068bdbe2b41","components/forms/Checkbox.jsx":"4307226f63c6","components/forms/FormField.jsx":"3f50573d93de","components/forms/Input.jsx":"df0fcbc1a165","components/forms/Radio.jsx":"d6f5d640cd13","components/forms/Select.jsx":"4a154c8317e3","components/forms/Switch.jsx":"02c9213b9174","components/forms/Textarea.jsx":"1590b360a812","components/marketing/FAQItem.jsx":"8d775f0fa391","components/marketing/Hero.jsx":"e55327455cd7","components/marketing/PricingCard.jsx":"3d9e89dad1ab","components/marketing/Testimonial.jsx":"cfb5284dcb8f","components/marketing/TimelineItem.jsx":"97e054d1e050","components/navigation/Breadcrumb.jsx":"397caae8f65e","components/navigation/Footer.jsx":"3674c0590b0d","components/navigation/Navbar.jsx":"e5b2214419d0","components/navigation/Pagination.jsx":"bad7eef794db","components/navigation/Sidebar.jsx":"9a9e160903ff","components/navigation/Tabs.jsx":"2dfe3c161d97","ui_kits/crm-pipeline/CrmPipelineApp.jsx":"f7e4c84bf632","ui_kits/marketing-site/MarketingSiteApp.jsx":"7c17393e736f","ui_kits/saas-dashboard/SaasDashboardApp.jsx":"1d86657f2176"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.CandyStudioDesignSystem_c687d1 = window.CandyStudioDesignSystem_c687d1 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const sizes = {
  sm: {
    padding: '8px 16px',
    fontSize: 'var(--text-sm)',
    height: 36
  },
  md: {
    padding: '10px 20px',
    fontSize: 'var(--text-base)',
    height: 44
  },
  lg: {
    padding: '14px 28px',
    fontSize: 'var(--text-lg)',
    height: 52
  }
};
const variants = {
  primary: {
    background: 'var(--color-primary)',
    color: '#fff',
    border: '1px solid transparent'
  },
  gradient: {
    background: 'var(--gradient-primary)',
    color: '#fff',
    border: '1px solid transparent'
  },
  secondary: {
    background: 'var(--surface-2)',
    color: 'var(--text)',
    border: '1px solid var(--border)'
  },
  outline: {
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--border-strong)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid transparent'
  },
  destructive: {
    background: 'var(--color-error)',
    color: '#fff',
    border: '1px solid transparent'
  }
};
function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  disabled,
  style,
  ...rest
}) {
  const s = sizes[size];
  const v = variants[variant];
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      fontFamily: 'var(--font-sans)',
      fontWeight: 600,
      borderRadius: 'var(--radius-md)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all var(--dur-base) var(--ease-out)',
      boxShadow: variant === 'primary' || variant === 'gradient' ? 'var(--shadow-sm)' : 'none',
      opacity: disabled ? 0.5 : 1,
      transform: hover && !disabled ? 'translateY(-1px)' : 'none',
      filter: hover && !disabled ? 'brightness(1.06)' : 'none',
      ...s,
      ...v,
      ...style
    }
  }, rest), icon, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function IconButton({
  children,
  variant = 'ghost',
  size = 'md',
  ...rest
}) {
  const dim = {
    sm: 32,
    md: 40,
    lg: 48
  }[size];
  const [hover, setHover] = React.useState(false);
  const bg = variant === 'ghost' ? hover ? 'var(--surface-2)' : 'transparent' : hover ? 'var(--color-primary-hover)' : 'var(--color-primary)';
  return /*#__PURE__*/React.createElement("button", _extends({
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      width: dim,
      height: dim,
      borderRadius: 'var(--radius-md)',
      border: variant === 'outline' ? '1px solid var(--border-strong)' : '1px solid transparent',
      background: bg,
      color: variant === 'ghost' || variant === 'outline' ? 'var(--text)' : '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all var(--dur-fast) var(--ease-out)'
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/data/BarChart.jsx
try { (() => {
function BarChart({
  data = [],
  height = 160
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 10,
      height,
      fontFamily: 'var(--font-sans)'
    }
  }, data.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: d.value / max * (height - 24),
      borderRadius: '6px 6px 0 0',
      background: 'var(--gradient-primary)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, d.label))));
}
Object.assign(__ds_scope, { BarChart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/BarChart.jsx", error: String((e && e.message) || e) }); }

// components/data/Calendar.jsx
try { (() => {
function Calendar({
  month = 'July 2026',
  days = [],
  events = {}
}) {
  const grid = days.length ? days : Array.from({
    length: 31
  }, (_, i) => i + 1);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 20,
      background: 'var(--bg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontFamily: 'var(--font-display)',
      marginBottom: 12,
      color: 'var(--text)'
    }
  }, month), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7,1fr)',
      gap: 6
    }
  }, grid.map(d => /*#__PURE__*/React.createElement("div", {
    key: d,
    style: {
      aspectRatio: '1',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--text-xs)',
      color: 'var(--text)',
      background: events[d] ? 'var(--color-primary-subtle)' : 'transparent',
      fontWeight: events[d] ? 700 : 400
    }
  }, d, events[d] && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 4,
      height: 4,
      borderRadius: '50%',
      background: 'var(--color-primary)',
      marginTop: 2
    }
  })))));
}
Object.assign(__ds_scope, { Calendar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Calendar.jsx", error: String((e && e.message) || e) }); }

// components/data/Card.jsx
try { (() => {
function Card({
  children,
  style,
  hoverable
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      boxShadow: hoverable && hover ? 'var(--shadow-md)' : 'var(--shadow-xs)',
      transform: hoverable && hover ? 'translateY(-2px)' : 'none',
      transition: 'all var(--dur-base) var(--ease-out)',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Card.jsx", error: String((e && e.message) || e) }); }

// components/data/KanbanCard.jsx
try { (() => {
function KanbanCard({
  title,
  tag,
  tagTone = 'primary',
  assignee,
  due
}) {
  const tones = {
    primary: 'var(--color-primary-subtle)',
    success: 'var(--color-success-subtle)',
    warning: 'var(--color-warning-subtle)'
  };
  const fgs = {
    primary: 'var(--color-primary)',
    success: 'var(--color-success-strong)',
    warning: 'var(--color-warning-strong)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 14,
      fontFamily: 'var(--font-sans)',
      boxShadow: 'var(--shadow-xs)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, tag && /*#__PURE__*/React.createElement("span", {
    style: {
      alignSelf: 'flex-start',
      fontSize: 11,
      fontWeight: 600,
      padding: '3px 8px',
      borderRadius: 'var(--radius-full)',
      background: tones[tagTone],
      color: fgs[tagTone]
    }
  }, tag), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: 'var(--text)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, due), assignee && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: 'var(--gradient-primary)',
      color: '#fff',
      fontSize: 10,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, assignee)));
}
Object.assign(__ds_scope, { KanbanCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/KanbanCard.jsx", error: String((e && e.message) || e) }); }

// components/data/StatCard.jsx
try { (() => {
function StatCard({
  label,
  value,
  delta,
  deltaTone = 'success',
  icon
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 20,
      fontFamily: 'var(--font-sans)',
      boxShadow: 'var(--shadow-xs)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
      fontWeight: 500
    }
  }, label), icon && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-primary)'
    }
  }, icon)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-3xl)',
      fontWeight: 700,
      color: 'var(--text)',
      fontFamily: 'var(--font-display)',
      marginTop: 8
    }
  }, value), delta && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      color: deltaTone === 'success' ? 'var(--color-success-strong)' : 'var(--color-error-strong)',
      marginTop: 6
    }
  }, delta));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/data/Table.jsx
try { (() => {
function Table({
  columns = [],
  rows = []
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: 'var(--surface)'
    }
  }, columns.map((c, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      textAlign: 'left',
      padding: '12px 16px',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
      borderBottom: '1px solid var(--border)'
    }
  }, c)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, ri) => /*#__PURE__*/React.createElement("tr", {
    key: ri,
    style: {
      borderBottom: ri < rows.length - 1 ? '1px solid var(--border)' : 'none'
    }
  }, r.map((cell, ci) => /*#__PURE__*/React.createElement("td", {
    key: ci,
    style: {
      padding: '14px 16px',
      fontSize: 'var(--text-sm)',
      color: 'var(--text)'
    }
  }, cell)))))));
}
Object.assign(__ds_scope, { Table });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Table.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Badge.jsx
try { (() => {
const tones = {
  neutral: {
    bg: 'var(--surface-2)',
    fg: 'var(--text)'
  },
  primary: {
    bg: 'var(--color-primary-subtle)',
    fg: 'var(--color-primary)'
  },
  success: {
    bg: 'var(--color-success-subtle)',
    fg: 'var(--color-success-strong)'
  },
  warning: {
    bg: 'var(--color-warning-subtle)',
    fg: 'var(--color-warning-strong)'
  },
  error: {
    bg: 'var(--color-error-subtle)',
    fg: 'var(--color-error-strong)'
  }
};
function Badge({
  children,
  tone = 'neutral',
  dot
}) {
  const t = tones[tone];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 'var(--radius-full)',
      background: t.bg,
      color: t.fg,
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-xs)',
      fontWeight: 600
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: t.fg
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Badge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function Dialog({
  title,
  description,
  children,
  onClose,
  footer
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(9,9,11,0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: 440,
      background: 'var(--bg)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-xl)',
      padding: 28,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 700,
      color: 'var(--text)',
      fontFamily: 'var(--font-display)'
    }
  }, title), description && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
      marginTop: 8
    }
  }, description), children && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 24
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tag.jsx
try { (() => {
function Tag({
  children,
  onRemove
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 10px',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
      background: 'var(--bg)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-xs)',
      fontWeight: 500,
      color: 'var(--text)'
    }
  }, children, onRemove && /*#__PURE__*/React.createElement("span", {
    onClick: onRemove,
    style: {
      cursor: 'pointer',
      color: 'var(--text-muted)'
    }
  }, "\xD7"));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
const icons = {
  success: '✓',
  error: '!',
  info: 'i'
};
const colors = {
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  info: 'var(--color-primary)'
};
function Toast({
  title,
  description,
  tone = 'success',
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      width: 340,
      padding: 16,
      borderRadius: 'var(--radius-lg)',
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-lg)',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: colors[tone],
      color: '#fff',
      fontSize: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, icons[tone]), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: 'var(--text)'
    }
  }, title), description && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, description)), onClose && /*#__PURE__*/React.createElement("span", {
    onClick: onClose,
    style: {
      cursor: 'pointer',
      color: 'var(--text-muted)'
    }
  }, "\xD7"));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function Tooltip({
  children,
  label
}) {
  const [show, setShow] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex'
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false)
  }, children, show && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      bottom: '125%',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--zinc-900)',
      color: '#fff',
      fontSize: 'var(--text-xs)',
      padding: '6px 10px',
      borderRadius: 'var(--radius-sm)',
      whiteSpace: 'nowrap',
      boxShadow: 'var(--shadow-md)'
    }
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Checkbox({
  label,
  checked,
  onChange,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--text)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: 6,
      border: '1px solid ' + (checked ? 'var(--color-primary)' : 'var(--border-strong)'),
      background: checked ? 'var(--color-primary)' : 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all var(--dur-fast) var(--ease-out)'
    }
  }, checked && /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "3"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6L9 17l-5-5"
  }))), /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    checked: checked,
    onChange: onChange,
    style: {
      display: 'none'
    }
  }, rest)), label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/FormField.jsx
try { (() => {
function FormField({
  label,
  hint,
  error,
  required,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-sans)'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 500,
      color: 'var(--text)'
    }
  }, label, required && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-error)'
    }
  }, " *")), children, error ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--color-error)'
    }
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { FormField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/FormField.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  error,
  icon,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 14,
      color: 'var(--text-muted)',
      display: 'flex'
    }
  }, icon), /*#__PURE__*/React.createElement("input", _extends({
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      color: 'var(--text)',
      padding: icon ? '11px 14px 11px 40px' : '11px 14px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid ' + (error ? 'var(--color-error)' : focus ? 'var(--color-primary)' : 'var(--border)'),
      outline: 'none',
      background: 'var(--bg)',
      transition: 'all var(--dur-fast) var(--ease-out)',
      boxShadow: focus ? 'var(--shadow-glow-primary)' : 'none',
      ...style
    }
  }, rest)));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Radio({
  label,
  checked,
  onChange,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--text)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: '50%',
      border: '1px solid ' + (checked ? 'var(--color-primary)' : 'var(--border-strong)'),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, checked && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: 'var(--color-primary)'
    }
  })), /*#__PURE__*/React.createElement("input", _extends({
    type: "radio",
    checked: checked,
    onChange: onChange,
    style: {
      display: 'none'
    }
  }, rest)), label);
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("select", _extends({
    style: {
      width: '100%',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      color: 'var(--text)',
      padding: '11px 14px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      background: 'var(--bg)',
      outline: 'none',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Switch({
  checked,
  onChange,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    role: "switch",
    "aria-checked": checked,
    onClick: () => onChange && onChange(!checked),
    style: {
      width: 40,
      height: 24,
      borderRadius: 999,
      border: 'none',
      padding: 2,
      background: checked ? 'var(--color-primary)' : 'var(--zinc-300)',
      cursor: 'pointer',
      transition: 'background var(--dur-base) var(--ease-out)'
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      width: 20,
      height: 20,
      borderRadius: '50%',
      background: '#fff',
      boxShadow: 'var(--shadow-sm)',
      transform: checked ? 'translateX(16px)' : 'translateX(0)',
      transition: 'transform var(--dur-base) var(--ease-spring)'
    }
  }));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Textarea({
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("textarea", _extends({
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      minHeight: 96,
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      color: 'var(--text)',
      padding: '11px 14px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid ' + (focus ? 'var(--color-primary)' : 'var(--border)'),
      outline: 'none',
      resize: 'vertical',
      boxShadow: focus ? 'var(--shadow-glow-primary)' : 'none',
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/marketing/FAQItem.jsx
try { (() => {
function FAQItem({
  question,
  answer,
  defaultOpen
}) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: '1px solid var(--border)',
      padding: '20px 0',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setOpen(!open),
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-base)',
      fontWeight: 600,
      color: 'var(--text)'
    }
  }, question), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)',
      transform: open ? 'rotate(45deg)' : 'none',
      transition: 'transform var(--dur-base) var(--ease-out)'
    }
  }, "+")), open && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
      lineHeight: 1.6,
      marginTop: 12
    }
  }, answer));
}
Object.assign(__ds_scope, { FAQItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/FAQItem.jsx", error: String((e && e.message) || e) }); }

// components/marketing/Hero.jsx
try { (() => {
function Hero({
  eyebrow,
  title,
  subtitle,
  actions
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      textAlign: 'center',
      padding: '96px 24px',
      background: 'var(--gradient-mesh), var(--bg)',
      fontFamily: 'var(--font-sans)'
    }
  }, eyebrow && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      padding: '6px 14px',
      borderRadius: 'var(--radius-full)',
      background: 'var(--color-primary-subtle)',
      color: 'var(--color-primary)',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      marginBottom: 20
    }
  }, eyebrow), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--font-display-size)',
      fontWeight: 700,
      letterSpacing: 'var(--tracking-tighter)',
      color: 'var(--text)',
      margin: '0 0 20px',
      lineHeight: 1.05,
      maxWidth: 800,
      marginInline: 'auto'
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-lg)',
      color: 'var(--text-muted)',
      maxWidth: 560,
      margin: '0 auto 32px',
      lineHeight: 1.6
    }
  }, subtitle), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      justifyContent: 'center'
    }
  }, actions));
}
Object.assign(__ds_scope, { Hero });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/Hero.jsx", error: String((e && e.message) || e) }); }

// components/marketing/PricingCard.jsx
try { (() => {
function PricingCard({
  name,
  price,
  period = '/mo',
  description,
  features = [],
  highlighted,
  cta = 'Get started'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      borderRadius: 'var(--radius-xl)',
      padding: 32,
      fontFamily: 'var(--font-sans)',
      background: highlighted ? 'var(--zinc-950)' : 'var(--bg)',
      color: highlighted ? '#fff' : 'var(--text)',
      border: highlighted ? 'none' : '1px solid var(--border)',
      boxShadow: highlighted ? 'var(--shadow-xl)' : 'var(--shadow-xs)',
      transform: highlighted ? 'translateY(-8px)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: highlighted ? 'var(--zinc-400)' : 'var(--text-muted)'
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 4,
      margin: '12px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-5xl)',
      fontWeight: 700,
      fontFamily: 'var(--font-display)'
    }
  }, price), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: highlighted ? 'var(--zinc-400)' : 'var(--text-muted)'
    }
  }, period)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      color: highlighted ? 'var(--zinc-400)' : 'var(--text-muted)',
      marginBottom: 24
    }
  }, description), /*#__PURE__*/React.createElement("button", {
    style: {
      width: '100%',
      padding: '12px',
      borderRadius: 'var(--radius-md)',
      border: 'none',
      fontWeight: 600,
      marginBottom: 24,
      cursor: 'pointer',
      background: highlighted ? 'var(--gradient-primary)' : 'var(--surface-2)',
      color: highlighted ? '#fff' : 'var(--text)'
    }
  }, cta), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, features.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 8,
      fontSize: 'var(--text-sm)',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-accent)'
    }
  }, "\u2713"), f))));
}
Object.assign(__ds_scope, { PricingCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/PricingCard.jsx", error: String((e && e.message) || e) }); }

// components/marketing/Testimonial.jsx
try { (() => {
function Testimonial({
  quote,
  name,
  role,
  avatar
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 28,
      fontFamily: 'var(--font-sans)',
      boxShadow: 'var(--shadow-xs)'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-lg)',
      color: 'var(--text)',
      lineHeight: 1.6,
      margin: '0 0 20px'
    }
  }, "\u201C", quote, "\u201D"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: '50%',
      background: avatar || 'var(--gradient-primary)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: 'var(--text-sm)'
    }
  }, name?.[0]), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: 'var(--text)'
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, role))));
}
Object.assign(__ds_scope, { Testimonial });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/Testimonial.jsx", error: String((e && e.message) || e) }); }

// components/marketing/TimelineItem.jsx
try { (() => {
function TimelineItem({
  date,
  title,
  description,
  isLast
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: 'var(--color-primary)',
      flexShrink: 0,
      marginTop: 4
    }
  }), !isLast && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 2,
      flex: 1,
      background: 'var(--border)',
      marginTop: 4
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      fontWeight: 600,
      marginBottom: 4
    }
  }, date), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-base)',
      fontWeight: 700,
      color: 'var(--text)',
      fontFamily: 'var(--font-display)'
    }
  }, title), description && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
      marginTop: 6,
      lineHeight: 1.6
    }
  }, description)));
}
Object.assign(__ds_scope, { TimelineItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/TimelineItem.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Breadcrumb.jsx
try { (() => {
function Breadcrumb({
  items = []
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", null, "/"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: i === items.length - 1 ? 'var(--text)' : 'var(--text-muted)',
      fontWeight: i === items.length - 1 ? 600 : 400
    }
  }, it))));
}
Object.assign(__ds_scope, { Breadcrumb });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Breadcrumb.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Footer.jsx
try { (() => {
function Footer({
  logo,
  columns = [],
  bottom
}) {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      padding: '64px 32px 32px',
      borderTop: '1px solid var(--border)',
      fontFamily: 'var(--font-sans)',
      background: 'var(--surface)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 64,
      maxWidth: 1280,
      margin: '0 auto',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 200px',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--text-lg)',
      color: 'var(--text)'
    }
  }, logo), columns.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.04em'
    }
  }, c.title), c.links.map((l, li) => /*#__PURE__*/React.createElement("a", {
    key: li,
    href: "#",
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text)'
    }
  }, l))))), bottom && /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1280,
      margin: '40px auto 0',
      paddingTop: 20,
      borderTop: '1px solid var(--border)',
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, bottom));
}
Object.assign(__ds_scope, { Footer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Footer.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Navbar.jsx
try { (() => {
function Navbar({
  logo,
  links = [],
  actions
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 32px',
      borderBottom: '1px solid var(--border)',
      background: 'rgba(255,255,255,0.8)',
      backdropFilter: 'blur(8px)',
      position: 'sticky',
      top: 0,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--text-lg)',
      color: 'var(--text)'
    }
  }, logo), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 28
    }
  }, links.map((l, i) => /*#__PURE__*/React.createElement("a", {
    key: i,
    href: l.href || '#',
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 500,
      color: 'var(--text-muted)'
    }
  }, l.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, actions));
}
Object.assign(__ds_scope, { Navbar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Navbar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Pagination.jsx
try { (() => {
function Pagination({
  page = 1,
  totalPages = 1,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onChange && onChange(Math.max(1, page - 1)),
    style: {
      width: 32,
      height: 32,
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
      background: 'var(--bg)',
      cursor: 'pointer'
    }
  }, "\u2039"), Array.from({
    length: totalPages
  }, (_, i) => i + 1).slice(0, 7).map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    onClick: () => onChange && onChange(p),
    style: {
      width: 32,
      height: 32,
      borderRadius: 'var(--radius-sm)',
      border: '1px solid ' + (p === page ? 'var(--color-primary)' : 'var(--border)'),
      background: p === page ? 'var(--color-primary)' : 'var(--bg)',
      color: p === page ? '#fff' : 'var(--text)',
      cursor: 'pointer',
      fontWeight: 600
    }
  }, p)), /*#__PURE__*/React.createElement("button", {
    onClick: () => onChange && onChange(Math.min(totalPages, page + 1)),
    style: {
      width: 32,
      height: 32,
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
      background: 'var(--bg)',
      cursor: 'pointer'
    }
  }, "\u203A"));
}
Object.assign(__ds_scope, { Pagination });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Pagination.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Sidebar.jsx
try { (() => {
function Sidebar({
  logo,
  sections = [],
  activeId,
  footer
}) {
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 240,
      height: '100%',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 20px 8px',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--text-base)',
      color: 'var(--text)'
    }
  }, logo), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '8px 12px'
    }
  }, sections.map((sec, si) => /*#__PURE__*/React.createElement("div", {
    key: si,
    style: {
      marginBottom: 16
    }
  }, sec.title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      padding: '6px 10px'
    }
  }, sec.title), sec.items.map(it => /*#__PURE__*/React.createElement("div", {
    key: it.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 10px',
      borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--text-sm)',
      fontWeight: 500,
      color: activeId === it.id ? 'var(--color-primary)' : 'var(--text)',
      background: activeId === it.id ? 'var(--color-primary-subtle)' : 'transparent',
      cursor: 'pointer'
    }
  }, it.icon, it.label))))), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      borderTop: '1px solid var(--border)'
    }
  }, footer));
}
Object.assign(__ds_scope, { Sidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Sidebar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  tabs = [],
  active,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      borderBottom: '1px solid var(--border)',
      fontFamily: 'var(--font-sans)'
    }
  }, tabs.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    onClick: () => onChange && onChange(t.id),
    style: {
      padding: '10px 16px',
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: active === t.id ? 'var(--color-primary)' : 'var(--text-muted)',
      borderBottom: '2px solid ' + (active === t.id ? 'var(--color-primary)' : 'transparent'),
      cursor: 'pointer',
      transition: 'all var(--dur-fast) var(--ease-out)'
    }
  }, t.label)));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/crm-pipeline/CrmPipelineApp.jsx
try { (() => {
const {
  Sidebar,
  KanbanCard,
  Button,
  Badge,
  Breadcrumb,
  IconButton,
  Input,
  StatCard
} = window.CandyStudioDesignSystem_c687d1;
function Icon({
  name,
  size = 16
}) {
  return /*#__PURE__*/React.createElement("i", {
    "data-lucide": name,
    style: {
      width: size,
      height: size,
      display: 'inline-flex'
    }
  });
}
function useLucide() {
  React.useEffect(() => {
    window.lucide && window.lucide.createIcons();
  });
}
function HomeIcon() {
  return /*#__PURE__*/React.createElement(Icon, {
    name: "layout-dashboard"
  });
}
function DealsIcon() {
  return /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch"
  });
}
function ContactsIcon() {
  return /*#__PURE__*/React.createElement(Icon, {
    name: "users"
  });
}
function SearchIcon() {
  return /*#__PURE__*/React.createElement(Icon, {
    name: "search"
  });
}
function PlusIcon() {
  return /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  });
}
const COLUMNS = [{
  id: 'lead',
  title: 'Lead',
  tone: 'primary',
  deals: [{
    title: 'Northwind Logistics — Onboarding',
    tag: 'Novo',
    assignee: 'AS',
    due: 'Até seg'
  }, {
    title: 'Vertex Health — Revamp do site',
    tag: 'Novo',
    assignee: 'JD',
    due: 'Até qua'
  }]
}, {
  id: 'qualified',
  title: 'Qualificado',
  tone: 'primary',
  deals: [{
    title: 'Fintra — MVP de dashboard',
    tag: 'Qualificado',
    assignee: 'MC',
    due: 'Até sex'
  }]
}, {
  id: 'negotiation',
  title: 'Negociação',
  tone: 'warning',
  deals: [{
    title: 'Acme Corp — Renovação',
    tag: 'Negociação',
    assignee: 'JD',
    due: 'Até sex'
  }, {
    title: 'Globex — Construção de CRM',
    tag: 'Negociação',
    assignee: 'AS',
    due: 'Até seg'
  }]
}, {
  id: 'won',
  title: 'Ganho',
  tone: 'success',
  deals: [{
    title: 'Initech — Landing page',
    tag: 'Ganho',
    assignee: 'MC',
    due: 'Fechado'
  }]
}];
function TopBar() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 28px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)'
    }
  }, /*#__PURE__*/React.createElement(Breadcrumb, {
    items: ['CRM', 'Pipeline']
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 240
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Buscar neg\xF3cios...",
    icon: /*#__PURE__*/React.createElement(SearchIcon, null)
  })), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    icon: /*#__PURE__*/React.createElement(PlusIcon, null)
  }, "Novo neg\xF3cio")));
}
function Column({
  col
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 4px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 'var(--text-sm)',
      color: 'var(--text)'
    }
  }, col.title), /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral"
  }, col.deals.length)), /*#__PURE__*/React.createElement(IconButton, {
    variant: "ghost",
    size: "sm"
  }, /*#__PURE__*/React.createElement(PlusIcon, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, col.deals.map((d, i) => /*#__PURE__*/React.createElement(KanbanCard, {
    key: i,
    title: d.title,
    tag: d.tag,
    tagTone: col.tone,
    assignee: d.assignee,
    due: d.due
  }))));
}
function CrmPipelineApp() {
  useLucide();
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: '100vh',
      fontFamily: 'var(--font-sans)',
      background: 'var(--surface)'
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    logo: "Candy Studio",
    activeId: "pipeline",
    sections: [{
      title: 'CRM',
      items: [{
        id: 'overview',
        label: 'Visão geral',
        icon: /*#__PURE__*/React.createElement(HomeIcon, null)
      }, {
        id: 'pipeline',
        label: 'Pipeline',
        icon: /*#__PURE__*/React.createElement(DealsIcon, null)
      }, {
        id: 'contacts',
        label: 'Contatos',
        icon: /*#__PURE__*/React.createElement(ContactsIcon, null)
      }]
    }],
    footer: /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--text-muted)'
      }
    }, "Workspace Acme", /*#__PURE__*/React.createElement("br", null), "Plano Pro")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement(TopBar, null), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 28,
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Valor do pipeline aberto",
    value: "$186.400",
    delta: "+8,2% neste trimestre"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Neg\xF3cios em negocia\xE7\xE3o",
    value: "6",
    delta: "+2"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Taxa de convers\xE3o",
    value: "42%",
    delta: "-3,1%",
    deltaTone: "error"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      overflowX: 'auto',
      paddingBottom: 8
    }
  }, COLUMNS.map(c => /*#__PURE__*/React.createElement(Column, {
    key: c.id,
    col: c
  }))))));
}
window.CrmPipelineApp = CrmPipelineApp;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/crm-pipeline/CrmPipelineApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing-site/MarketingSiteApp.jsx
try { (() => {
const {
  Navbar,
  Hero,
  PricingCard,
  FAQItem,
  Testimonial,
  Footer,
  Button,
  Badge
} = window.CandyStudioDesignSystem_c687d1;
function LogoMark() {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700
    }
  }, "Candy Studio");
}
function LogosStrip() {
  const names = ['Acme', 'Fintra', 'Northwind', 'Globex', 'Initech', 'Vertex'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 48,
      padding: '32px 24px',
      flexWrap: 'wrap',
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)'
    }
  }, names.map(n => /*#__PURE__*/React.createElement("span", {
    key: n,
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--text-lg)',
      color: 'var(--zinc-300)'
    }
  }, n)));
}
function ServiceCard({
  title,
  description
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      background: 'var(--bg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 12,
      background: 'var(--gradient-primary)',
      marginBottom: 16
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-lg)',
      marginBottom: 8,
      color: 'var(--text)'
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
      lineHeight: 1.6,
      margin: 0
    }
  }, description));
}
function ServicesSection() {
  const services = [['Landing pages e sites', 'Sites de marketing de alta conversão, construídos para velocidade e clareza.'], ['Plataformas SaaS', 'Produtos full-stack, do onboarding à cobrança.'], ['Dashboards e painéis admin', 'Interfaces densas em dados que continuam legíveis.'], ['CRM e sistemas de estoque', 'Pipelines customizados que se encaixam no jeito que seu time já trabalha.'], ['Agentes de IA e automação', 'Claude, GPT e Gemini conectados a workflows reais.'], ['Sistemas financeiros', 'Ferramentas de relatórios e reconciliação em que você pode confiar.']];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '80px 24px',
      maxWidth: 1280,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 48
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'var(--text-4xl)',
      margin: '0 0 12px',
      color: 'var(--text)'
    }
  }, "O que constru\xEDmos"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-muted)',
      fontSize: 'var(--text-lg)'
    }
  }, "Um sistema de design, todas as superf\xEDcies que seu produto precisa.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 20
    }
  }, services.map(([t, d]) => /*#__PURE__*/React.createElement(ServiceCard, {
    key: t,
    title: t,
    description: d
  }))));
}
function PricingSection() {
  const [yearly, setYearly] = React.useState(false);
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '80px 24px',
      maxWidth: 1100,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'var(--text-4xl)',
      margin: '0 0 12px',
      color: 'var(--text)'
    }
  }, "Pre\xE7os simples e transparentes")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 10,
      marginBottom: 40
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: !yearly ? 'primary' : 'ghost',
    onClick: () => setYearly(false)
  }, "Mensal"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: yearly ? 'primary' : 'ghost',
    onClick: () => setYearly(true)
  }, "Anual ", /*#__PURE__*/React.createElement(Badge, {
    tone: "success"
  }, "-20%"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(PricingCard, {
    name: "Starter",
    price: yearly ? '$79' : '$99',
    description: "Para uma landing page ou MVP",
    features: ['1 projeto ativo', 'Kit inicial de design system', 'Suporte por e-mail', 'Entrega em 2 semanas']
  }), /*#__PURE__*/React.createElement(PricingCard, {
    name: "Growth",
    price: yearly ? '$199' : '$249',
    description: "Para startups em crescimento",
    highlighted: true,
    features: ['3 projetos ativos', 'Biblioteca de componentes customizada', 'Suporte prioritário', 'Reuniões semanais']
  }), /*#__PURE__*/React.createElement(PricingCard, {
    name: "Scale",
    price: yearly ? '$399' : '$499',
    description: "Para times com funding, entregando r\xE1pido",
    features: ['Projetos ilimitados', 'Squad dedicado', 'Integrações com agentes de IA', 'Suporte no mesmo dia']
  })));
}
function FAQSection() {
  const faqs = [['Qual é o prazo de entrega?', 'A maioria dos MVPs e landing pages fica pronta em 2–4 semanas, dependendo do escopo.'], ['Vocês trabalham com nosso codebase atual?', 'Sim — nos conectamos a repositórios React/Next.js e os estendemos, ou começamos do zero com nossa própria stack.'], ['O que "AI-first" significa na prática?', 'Usamos desenvolvimento assistido por IA para ir mais rápido, e construímos agentes de IA e automações dentro dos próprios produtos.'], ['Vocês também constroem nossas ferramentas internas?', 'Sim — CRM, estoque e dashboards financeiros fazem parte do que construímos, não são um extra.']];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '80px 24px',
      maxWidth: 720,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'var(--text-4xl)',
      margin: '0 0 24px',
      color: 'var(--text)',
      textAlign: 'center'
    }
  }, "Perguntas frequentes"), faqs.map(([q, a], i) => /*#__PURE__*/React.createElement(FAQItem, {
    key: i,
    question: q,
    answer: a,
    defaultOpen: i === 0
  })));
}
function TestimonialsSection() {
  const items = [['A Candy Studio entregou nosso MVP em três semanas — e parecia um produto de uma Series B.', 'Mia Chen', 'CEO, Fintra'], ['Nosso dashboard finalmente parece tão bom quanto as ferramentas que pagamos.', 'Diego Alvarez', 'COO, Northwind Logistics'], ['Eles entenderam nossa marca melhor do que nossas últimas três agências juntas.', 'Priya Nair', 'Fundadora, Vertex Health']];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '80px 24px',
      maxWidth: 1280,
      margin: '0 auto',
      background: 'var(--surface)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'var(--text-4xl)',
      margin: '0 0 40px',
      color: 'var(--text)',
      textAlign: 'center'
    }
  }, "Amado por fundadores"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 20
    }
  }, items.map(([q, n, r]) => /*#__PURE__*/React.createElement(Testimonial, {
    key: n,
    quote: q,
    name: n,
    role: r
  }))));
}
function CTASection() {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '96px 24px',
      textAlign: 'center',
      background: 'var(--zinc-950)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'var(--text-4xl)',
      color: '#fff',
      margin: '0 0 16px'
    }
  }, "Vamos construir seu pr\xF3ximo produto."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--zinc-400)',
      fontSize: 'var(--text-lg)',
      margin: '0 0 32px'
    }
  }, "Agende uma call de 30 minutos \u2014 sem pitch deck, s\xF3 um plano."), /*#__PURE__*/React.createElement(Button, {
    variant: "gradient",
    size: "lg"
  }, "Agendar call"));
}
function MarketingSiteApp() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--bg)'
    }
  }, /*#__PURE__*/React.createElement(Navbar, {
    logo: /*#__PURE__*/React.createElement(LogoMark, null),
    links: [{
      label: 'Produto'
    }, {
      label: 'Preços'
    }, {
      label: 'Portfólio'
    }, {
      label: 'Docs'
    }],
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm"
    }, "Entrar"), /*#__PURE__*/React.createElement(Button, {
      size: "sm"
    }, "Come\xE7ar"))
  }), /*#__PURE__*/React.createElement(Hero, {
    eyebrow: "Ag\xEAncia digital AI-first",
    title: "Lance produtos que convertem.",
    subtitle: "UI premium, arquitetura limpa, desenvolvimento assistido por IA e entrega r\xE1pida \u2014 para startups e times em crescimento.",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "gradient",
      size: "lg"
    }, "Agendar call"), /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "lg"
    }, "Ver portf\xF3lio"))
  }), /*#__PURE__*/React.createElement(LogosStrip, null), /*#__PURE__*/React.createElement(ServicesSection, null), /*#__PURE__*/React.createElement(PricingSection, null), /*#__PURE__*/React.createElement(TestimonialsSection, null), /*#__PURE__*/React.createElement(FAQSection, null), /*#__PURE__*/React.createElement(CTASection, null), /*#__PURE__*/React.createElement(Footer, {
    logo: /*#__PURE__*/React.createElement(LogoMark, null),
    columns: [{
      title: 'Produto',
      links: ['Landing Pages', 'Dashboards', 'CRM', 'Agentes de IA']
    }, {
      title: 'Empresa',
      links: ['Sobre', 'Carreiras', 'Contato']
    }, {
      title: 'Recursos',
      links: ['Blog', 'Docs', 'Design System']
    }],
    bottom: "\xA9 2026 Candy Studio. Todos os direitos reservados."
  }));
}
window.MarketingSiteApp = MarketingSiteApp;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing-site/MarketingSiteApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/saas-dashboard/SaasDashboardApp.jsx
try { (() => {
const {
  Sidebar,
  StatCard,
  Card,
  Table,
  BarChart,
  Badge,
  Button,
  Breadcrumb,
  IconButton,
  Input,
  Tabs
} = window.CandyStudioDesignSystem_c687d1;
function Icon({
  name,
  size = 16
}) {
  return /*#__PURE__*/React.createElement("i", {
    "data-lucide": name,
    style: {
      width: size,
      height: size,
      display: 'inline-flex'
    }
  });
}
function useLucide() {
  React.useEffect(() => {
    window.lucide && window.lucide.createIcons();
  });
}
function HomeIcon() {
  return /*#__PURE__*/React.createElement(Icon, {
    name: "layout-dashboard"
  });
}
function ChartIcon() {
  return /*#__PURE__*/React.createElement(Icon, {
    name: "bar-chart-3"
  });
}
function UsersIcon() {
  return /*#__PURE__*/React.createElement(Icon, {
    name: "users"
  });
}
function SettingsIcon() {
  return /*#__PURE__*/React.createElement(Icon, {
    name: "settings"
  });
}
function SearchIcon() {
  return /*#__PURE__*/React.createElement(Icon, {
    name: "search"
  });
}
function BellIcon() {
  return /*#__PURE__*/React.createElement(Icon, {
    name: "bell"
  });
}
function TopBar() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 28px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)'
    }
  }, /*#__PURE__*/React.createElement(Breadcrumb, {
    items: ['Workspace', 'Visão geral']
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 260
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Buscar...",
    icon: /*#__PURE__*/React.createElement(SearchIcon, null)
  })), /*#__PURE__*/React.createElement(IconButton, {
    variant: "ghost"
  }, /*#__PURE__*/React.createElement(BellIcon, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: 'var(--gradient-primary)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: 13
    }
  }, "JD")));
}
function Overview() {
  const [tab, setTab] = React.useState('30d');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 28,
      display: 'flex',
      flexDirection: 'column',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'var(--text-3xl)',
      margin: 0,
      color: 'var(--text)'
    }
  }, "Vis\xE3o geral"), /*#__PURE__*/React.createElement(Tabs, {
    tabs: [{
      id: '7d',
      label: '7 dias'
    }, {
      id: '30d',
      label: '30 dias'
    }, {
      id: '90d',
      label: '90 dias'
    }],
    active: tab,
    onChange: setTab
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "MRR",
    value: "$48.200",
    delta: "+12,4% vs m\xEAs anterior",
    icon: /*#__PURE__*/React.createElement(ChartIcon, null)
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Clientes ativos",
    value: "1.284",
    delta: "+3,1%",
    icon: /*#__PURE__*/React.createElement(UsersIcon, null)
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Taxa de churn",
    value: "1,8%",
    delta: "-0,3%",
    icon: /*#__PURE__*/React.createElement(ChartIcon, null)
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Ticket m\xE9dio",
    value: "$2.140",
    delta: "-4,2%",
    deltaTone: "error",
    icon: /*#__PURE__*/React.createElement(ChartIcon, null)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontFamily: 'var(--font-display)',
      color: 'var(--text)'
    }
  }, "Receita"), /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    dot: true
  }, "Em tempo real")), /*#__PURE__*/React.createElement(BarChart, {
    data: [{
      label: 'Jan',
      value: 32
    }, {
      label: 'Feb',
      value: 41
    }, {
      label: 'Mar',
      value: 38
    }, {
      label: 'Apr',
      value: 55
    }, {
      label: 'May',
      value: 49
    }, {
      label: 'Jun',
      value: 62
    }, {
      label: 'Jul',
      value: 71
    }],
    height: 200
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontFamily: 'var(--font-display)',
      color: 'var(--text)',
      marginBottom: 16
    }
  }, "Mix de planos"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, [['Starter', 34, 'var(--zinc-300)'], ['Growth', 48, 'var(--color-primary)'], ['Scale', 18, 'var(--color-secondary)']].map(([n, v, c]) => /*#__PURE__*/React.createElement("div", {
    key: n
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      color: 'var(--text-muted)',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", null, n), /*#__PURE__*/React.createElement("span", null, v, "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8,
      borderRadius: 99,
      background: 'var(--surface-2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: v + '%',
      height: 8,
      borderRadius: 99,
      background: c
    }
  }))))))), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px',
      fontWeight: 700,
      fontFamily: 'var(--font-display)',
      color: 'var(--text)',
      borderBottom: '1px solid var(--border)'
    }
  }, "Clientes recentes"), /*#__PURE__*/React.createElement(Table, {
    columns: ['Cliente', 'Plano', 'MRR', 'Status'],
    rows: [['Acme Inc', 'Growth', '$249', /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true
    }, "Ativo")], ['Globex', 'Scale', '$499', /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true
    }, "Ativo")], ['Initech', 'Starter', '$99', /*#__PURE__*/React.createElement(Badge, {
      tone: "warning"
    }, "Trial")], ['Northwind', 'Growth', '$249', /*#__PURE__*/React.createElement(Badge, {
      tone: "error"
    }, "Em atraso")]]
  })));
}
function SaasDashboardApp() {
  useLucide();
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: '100vh',
      fontFamily: 'var(--font-sans)',
      background: 'var(--surface)'
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    logo: "Candy Studio",
    activeId: "overview",
    sections: [{
      title: 'Workspace',
      items: [{
        id: 'overview',
        label: 'Visão geral',
        icon: /*#__PURE__*/React.createElement(HomeIcon, null)
      }, {
        id: 'analytics',
        label: 'Analytics',
        icon: /*#__PURE__*/React.createElement(ChartIcon, null)
      }, {
        id: 'customers',
        label: 'Clientes',
        icon: /*#__PURE__*/React.createElement(UsersIcon, null)
      }]
    }, {
      title: 'Conta',
      items: [{
        id: 'settings',
        label: 'Configurações',
        icon: /*#__PURE__*/React.createElement(SettingsIcon, null)
      }]
    }],
    footer: /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--text-muted)'
      }
    }, "Workspace Acme", /*#__PURE__*/React.createElement("br", null), "Plano Pro")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement(TopBar, null), /*#__PURE__*/React.createElement(Overview, null)));
}
window.SaasDashboardApp = SaasDashboardApp;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/saas-dashboard/SaasDashboardApp.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.BarChart = __ds_scope.BarChart;

__ds_ns.Calendar = __ds_scope.Calendar;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.KanbanCard = __ds_scope.KanbanCard;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.FormField = __ds_scope.FormField;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.FAQItem = __ds_scope.FAQItem;

__ds_ns.Hero = __ds_scope.Hero;

__ds_ns.PricingCard = __ds_scope.PricingCard;

__ds_ns.Testimonial = __ds_scope.Testimonial;

__ds_ns.TimelineItem = __ds_scope.TimelineItem;

__ds_ns.Breadcrumb = __ds_scope.Breadcrumb;

__ds_ns.Footer = __ds_scope.Footer;

__ds_ns.Navbar = __ds_scope.Navbar;

__ds_ns.Pagination = __ds_scope.Pagination;

__ds_ns.Sidebar = __ds_scope.Sidebar;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
