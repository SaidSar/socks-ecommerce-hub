// Documentos legales de la tienda. Cada bloque es un párrafo (string) o una lista ({ list: [...] }).
// Ilustrativos: SOKKO es un proyecto académico (la página muestra el aviso arriba).

export const STORE_EMAIL = 'hola@sokko.mx'
export const BUSINESS_HOURS = 'Lunes a viernes, 9:00 a 18:00 (hora del Pacífico)'
export const ACADEMIC_NOTICE =
  'SOKKO es un proyecto académico; este documento es ilustrativo y no constituye una oferta comercial real.'

const RESPONSIBLE =
  'SOKKO (ソッコ), proyecto académico del equipo NEXUS CODE de la Universidad Autónoma de Occidente (UAdeO), con domicilio de referencia en Los Mochis, Sinaloa, México'

export const PRIVACY = {
  slug: 'privacidad',
  title: 'Aviso de privacidad',
  description:
    'Aviso de privacidad integral de SOKKO conforme a la LFPDPPP: responsable, datos que recabamos, finalidades y cómo ejercer sus derechos ARCO.',
  updated: '2026-11-03T19:00:00Z',
  intro:
    'Este aviso explica qué datos personales recabamos cuando usted compra o se comunica con SOKKO, para qué los usamos y cómo puede ejercer sus derechos, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).',
  sections: [
    {
      id: 'responsable',
      title: 'Responsable',
      blocks: [`El responsable del tratamiento de sus datos personales es ${RESPONSIBLE}. Para cualquier asunto de privacidad escríbanos a ${STORE_EMAIL}.`],
    },
    {
      id: 'datos',
      title: 'Datos que recabamos',
      blocks: [
        'Recabamos únicamente los datos que usted nos proporciona al crear una cuenta, comprar o escribirnos:',
        {
          list: [
            'Identificación y contacto: nombre, apellido, correo electrónico y teléfono.',
            'Entrega: dirección, código postal, ciudad y referencias.',
            'Compra: piezas, tallas, importes, método de pago elegido y estado del pedido. No guardamos números de tarjeta: el pago lo procesa el proveedor de pagos.',
            'Preferencias: talla habitual y si desea recibir novedades.',
            'Técnicos: dirección IP y fecha de cada solicitud, para seguridad y para evitar abusos.',
          ],
        },
        'No recabamos datos personales sensibles.',
      ],
    },
    {
      id: 'finalidades',
      title: 'Finalidades',
      blocks: [
        'Finalidades primarias, necesarias para la relación con usted:',
        {
          list: [
            'Procesar, enviar y dar seguimiento a sus pedidos.',
            'Gestionar su cuenta, cambios, devoluciones y reembolsos.',
            'Responder los mensajes que nos envía por el formulario de contacto.',
            'Cumplir obligaciones fiscales y legales.',
          ],
        },
        'Finalidad secundaria: enviarle novedades y ediciones limitadas, solo si usted lo autorizó. Puede retirar ese permiso en cualquier momento escribiendo a nuestro correo, sin que afecte sus compras.',
      ],
    },
    {
      id: 'transferencias',
      title: 'Transferencias',
      blocks: [
        'Compartimos sus datos solo con quienes nos ayudan a cumplir su pedido: paquetería, repartidor local, proveedor de pagos y servicios de alojamiento en la nube. Estas transferencias no requieren su consentimiento (artículo 37 de la LFPDPPP). No vendemos ni rentamos sus datos.',
      ],
    },
    {
      id: 'arco',
      title: 'Derechos ARCO',
      blocks: [
        'Usted puede Acceder a sus datos, Rectificarlos, Cancelarlos u Oponerse a su uso (derechos ARCO), así como revocar su consentimiento. Envíe su solicitud a nuestro correo con:',
        {
          list: [
            'Su nombre y un medio para comunicarle la respuesta.',
            'Una copia de su identificación o la de su representante.',
            'La descripción clara del derecho que desea ejercer y de los datos involucrados.',
          ],
        },
        'Responderemos en un máximo de 20 días hábiles y, si procede, aplicaremos el cambio dentro de los 15 días hábiles siguientes.',
      ],
    },
    {
      id: 'cookies',
      title: 'Almacenamiento en su navegador',
      blocks: [
        'La tienda guarda en su navegador la bolsa de compra y la sesión para que no se pierdan al recargar. No usamos cookies de publicidad ni de rastreo de terceros. Puede borrarlos desde la configuración de su navegador.',
      ],
    },
    {
      id: 'cambios-aviso',
      title: 'Cambios a este aviso',
      blocks: ['Publicaremos cualquier cambio en esta misma página, con su fecha de actualización al pie.'],
    },
    {
      id: 'contacto-privacidad',
      title: 'Contacto',
      blocks: [`Correo: ${STORE_EMAIL}. Horario de atención: ${BUSINESS_HOURS}. Si considera que su derecho fue vulnerado, puede acudir al organismo garante de protección de datos personales.`],
    },
  ],
}

export const TERMS = {
  slug: 'terminos',
  title: 'Términos y condiciones',
  description: 'Términos y condiciones de uso y compra en la tienda en línea de SOKKO: precios, pagos, envíos, cambios y responsabilidad.',
  updated: '2026-11-03T19:00:00Z',
  intro:
    'Al navegar o comprar en la tienda de SOKKO usted acepta estos términos. Le pedimos leerlos con calma; si algo no queda claro, escríbanos antes de comprar.',
  sections: [
    {
      id: 'objeto',
      title: 'Objeto',
      blocks: [`Estos términos regulan el uso del sitio y la compra de calcetería y accesorios que ofrece ${RESPONSIBLE}.`],
    },
    {
      id: 'cuenta',
      title: 'Cuenta',
      blocks: [
        'Puede comprar como invitado o con una cuenta. Si crea una, usted es responsable de mantener su contraseña en secreto y de la información que registre. Podemos suspender cuentas usadas para fraude o abuso.',
      ],
    },
    {
      id: 'precios',
      title: 'Precios y disponibilidad',
      blocks: [
        'Los precios están en pesos mexicanos (MXN) e incluyen IVA. El costo de envío se muestra antes de pagar. Muchas piezas se tejen en lotes pequeños: la disponibilidad se confirma al cerrar el pedido y, si una pieza se agota en ese momento, se lo avisamos sin cobrarle.',
      ],
    },
    {
      id: 'pagos',
      title: 'Pagos',
      blocks: [
        'Aceptamos tarjeta de crédito o débito y OXXO Pay. Con OXXO Pay las piezas quedan apartadas 72 horas; si el pago no llega en ese plazo, el pedido se cancela y el inventario se libera.',
      ],
    },
    {
      id: 'envios-terminos',
      title: 'Envíos',
      blocks: ['Los plazos, costos y coberturas están en nuestra Política de envíos, que forma parte de estos términos.'],
    },
    {
      id: 'cambios-terminos',
      title: 'Cambios y devoluciones',
      blocks: ['Las condiciones están en nuestra Política de cambios y devoluciones, que forma parte de estos términos.'],
    },
    {
      id: 'propiedad',
      title: 'Propiedad intelectual',
      blocks: ['La marca SOKKO, el logotipo, los diseños de las piezas, las fotografías y los textos del sitio son de SOKKO o de sus titulares. No pueden usarse sin autorización por escrito.'],
    },
    {
      id: 'responsabilidad',
      title: 'Responsabilidad',
      blocks: [
        'Hacemos lo posible para que el sitio funcione sin interrupciones y que las fotos reflejen fielmente cada pieza; los tintes naturales pueden variar ligeramente de tono entre lotes. Nada en estos términos limita los derechos que le otorga la Ley Federal de Protección al Consumidor.',
      ],
    },
    {
      id: 'ley',
      title: 'Ley aplicable',
      blocks: [
        'Estos términos se rigen por las leyes de México. Ante cualquier controversia, primero buscaremos resolverla con usted por correo; también puede acudir a la Procuraduría Federal del Consumidor (Profeco).',
      ],
    },
  ],
}

export const RETURNS = {
  slug: 'devoluciones',
  title: 'Cambios y devoluciones',
  description: 'Política de cambios y devoluciones de SOKKO: 30 días para piezas sin uso, cómo solicitarlo y cómo recibe su reembolso.',
  updated: '2026-11-03T19:00:00Z',
  intro: 'Queremos que cada par le acompañe mucho tiempo. Si la talla o el tono no fueron los indicados, puede cambiarlos o devolverlos.',
  sections: [
    {
      id: 'plazo',
      title: 'Plazo',
      blocks: ['Tiene 30 días naturales desde que recibe su pedido para solicitar un cambio o una devolución.'],
    },
    {
      id: 'condiciones',
      title: 'Condiciones',
      blocks: [
        {
          list: [
            'La pieza debe estar sin uso, sin lavar y con su etiqueta.',
            'Por higiene, no aceptamos calcetas usadas, salvo defecto de fabricación.',
            'Las ediciones limitadas solo admiten cambio de talla, sujeto a disponibilidad; no se reembolsan.',
            'Las piezas con descuento fuera de temporada admiten cambio, no reembolso.',
          ],
        },
      ],
    },
    {
      id: 'solicitud',
      title: 'Cómo solicitarlo',
      blocks: [
        {
          list: [
            `Escríbanos a ${STORE_EMAIL} o desde el formulario de contacto con el asunto "Cambios y devoluciones".`,
            'Indique el folio de su pedido (SKK-####), la pieza y el motivo.',
            'Le enviamos la guía de retorno o, en Los Mochis, coordinamos la recolección.',
            'Al recibir y revisar la pieza le confirmamos el cambio o el reembolso.',
          ],
        },
      ],
    },
    {
      id: 'costos',
      title: 'Costos de envío',
      blocks: ['Si la pieza llegó con defecto o no era la que pidió, nosotros cubrimos el envío de ida y vuelta. En los demás casos el envío de retorno corre por su cuenta.'],
    },
    {
      id: 'reembolso',
      title: 'Reembolso',
      blocks: [
        'Reembolsamos el importe de las piezas en un máximo de 10 días hábiles después de revisarlas. Con tarjeta, el reembolso va a la misma tarjeta; con OXXO Pay, por transferencia a la cuenta que nos indique. El envío original solo se reembolsa si el pedido llegó con defecto.',
      ],
    },
  ],
}
