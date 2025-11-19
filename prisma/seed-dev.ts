import {
  PrismaClient,
  SlotStudentsGroup,
  SlotModality,
  PaymentStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Admins
  const admins = [
    {
      name: 'Carlos Saez',
      email: 'salvaramos@gmail.com',
      password: 'admin123',
      rut: '12.345.678-9',
    },
    {
      name: 'Joaquín Concha',
      email: 'jconchan@outlook.com',
      password: 'admin123',
      rut: '98.765.432-1',
    },
    {
      name: 'Sebastian Espejp',
      email: 'sebastin@outlook.com',
      password: 'admin123',
      rut: '12.345.678-3',
    },
  ];
  for (const admin of admins) {
    const existing = await prisma.admin.findUnique({
      where: { email: admin.email },
    });
    if (!existing) {
      const passwordHash = await bcrypt.hash(admin.password, 10);
      await prisma.admin.create({
        data: {
          name: admin.name,
          email: admin.email,
          passwordHash,
          rut: admin.rut,
        },
      });
      console.log('Admin user created:', {
        email: admin.email,
        password: admin.password,
      });
    }
  }

  // Students
  const studentsData = [
    {
      name: 'Demo Student',
      email: 'student@demo.com',
      password: 'student123',
      phone: '1234567890',
      rut: '12345678-9',
      address: '123 Main St',
    },
    {
      name: 'Student 2',
      email: 'student2@demo.com',
      password: 'student456',
      phone: '2345678901',
      rut: '98765432-1',
      address: '456 Elm St',
    },
    {
      name: 'Student 3',
      email: 'student3@demo.com',
      password: 'student789',
      phone: '3456789012',
      rut: '11223344-5',
      address: '789 Oak St',
    },
    {
      name: 'Student 4',
      email: 'student4@demo.com',
      password: 'student101',
      phone: '4567890123',
      rut: '55667788-0',
      address: '101 Pine St',
    },
  ];
  const students: Array<{
    id: number;
    email: string;
    name: string;
    passwordHash: string;
    phone: string | null;
  }> = [];
  for (const student of studentsData) {
    let existing = await prisma.student.findUnique({
      where: { email: student.email },
    });
    if (!existing) {
      const passwordHash = await bcrypt.hash(student.password, 10);
      existing = await prisma.student.create({
        data: {
          name: student.name,
          email: student.email,
          passwordHash,
          phone: student.phone,
          rut: student.rut,
          address: student.address,
        },
      });
      console.log('Student user created:', {
        email: student.email,
        password: student.password,
      });
    }
    students.push(existing);
  }

  // Professors
  const professorsData = [
    {
      name: 'Carlos Saez',
      email: 'csaez@uc.cl',
      password: 'professor123',
      bio: 'Carloz Saez',
      profilePictureUrl: '',
      rut: '12.345.678-9',
    },
  ];
  const professors: Array<{
    id: number;
    email: string;
    name: string;
    bio: string | null;
    profilePictureUrl: string | null;
    rut: string | null;
  }> = [];
  for (const prof of professorsData) {
    let existing = await prisma.professor.findUnique({
      where: { email: prof.email },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        profilePictureUrl: true,
        rut: true,
      },
    });
    if (!existing) {
      const passwordHash = await bcrypt.hash(prof.password, 10);
      const { password, ...profData } = prof;
      existing = await prisma.professor.create({
        data: { ...profData, passwordHash },
        select: {
          id: true,
          email: true,
          name: true,
          bio: true,
          profilePictureUrl: true,
          rut: true,
        },
      });
      console.log('Professor user created:', { email: prof.email });
    }
    professors.push(existing);
  }

  // Courses
  const coursesData = [
    {
      title: 'Electricidad y Magnetismo',
      acronym: 'FIS1533',
      description: `
        Este curso aborda uno de los pilares de la física universitaria: cómo se comportan las cargas, los campos y las corrientes.
        Partimos con la electrostática, entendiendo fuerzas, potenciales y la ley de Gauss; avanzamos luego hacia la corriente eléctrica y los circuitos,
        desde resistencias simples hasta circuitos RC con capacitores. Después entramos en la magnetostática, analizando cómo las corrientes generan campos
        magnéticos con las leyes de Biot-Savart y Ampère, y finalmente cerramos con los campos electromagnéticos variables, incluyendo inducción, inductores,
        circuitos RLC y corriente alterna
      `,
      professors: [professors[0]],
    },
    {
      title: 'Dinámica',
      acronym: 'FIS1512',
      description: `
      Este curso se centra en el estudio del **movimiento y las fuerzas** que lo producen, uno
       de los pilares de la mecánica clásica. Comenzamos con la **cinemática**, analizando cómo describir trayectorias en distintas
       coordenadas —desde el movimiento rectilíneo hasta el circular y curvilíneo en polares y cilíndricas— para luego introducir
       las **leyes de Newton**, que permiten modelar la dinámica de partículas mediante diagramas de cuerpo libre, considerando fuerzas
       como peso, normal, rozamiento, elásticas y tensiones en sistemas con poleas o ligaduras.
      `,
      professors: [professors[0]],
    },
    {
      title: 'Optimización',
      acronym: 'ICS1113',
      description: `
        Este curso entrega las bases para formular y resolver problemas de decisión en ingeniería, economía y ciencias aplicadas.
        Comienza con la **modelación matemática**, aprendiendo a traducir situaciones reales en funciones objetivo y restricciones,
        y se revisan los fundamentos teóricos que aseguran la validez de los modelos: **existencia de soluciones, convexidad y equivalencias**.

        **Contenidos principales:**

        - **Modelación Matemática** - Variables de decisión, función objetivo, restricciones y tipos de modelos
        - **Fundamentos Teóricos** - Teorema de Bolzano-Weierstrass, convexidad y condiciones de existencia
        - **Programación Lineal** - Geometría poliédrica, método simplex, análisis postóptimo y dualidad
        - **Programación Entera** - Variables enteras, branch and bound, cortes de Gomory
        - **Optimización No Lineal** - Condiciones de optimalidad, multiplicadores de Lagrange, condiciones KKT

        El curso combina teoría rigurosa con aplicaciones prácticas, preparando a los estudiantes para resolver problemas
        reales de optimización en contextos industriales, financieros y logísticos.
      `,
      professors: [professors[0]],
    },
    {
      title: 'Cálculo II',
      acronym: 'MAT1620',
      description: '',
      professors: [professors[0]],
    },
    {
      title: 'Cálculo I',
      acronym: 'MAT1610',
      description: `
        Cálculo I es una materia fundamental para todas las carreras de ingeniería y ciencias. En este curso desarrollarás
        las habilidades necesarias para entender y aplicar los conceptos de límites, continuidad, derivadas e integrales básicas.

        **Contenidos principales:**

        - **Módulo 1: Límites y Continuidad** - Concepto de límite, cálculo de límites, continuidad y Teorema del Valor Intermedio
        - **Módulo 2: Derivadas** - Definición, interpretación, reglas de derivación y derivación de funciones trascendentes
        - **Módulo 3: Aplicaciones de las Derivadas** - Análisis de funciones, optimización, teoremas fundamentales y L'Hôpital
        - **Módulo 4: Introducción a las Integrales** - Antiderivadas, Teorema Fundamental del Cálculo e integrales definidas

        Incluye clases teóricas con demostraciones, clases prácticas con ejercicios tipo, apoyo personalizado y recursos
        complementarios como guías progresivas, formularios y simulacros de certámenes.
      `,
      professors: [professors[0]],
    },
  ];
  const courses = [];
  for (const course of coursesData) {
    let existing = await prisma.course.findFirst({
      where: { title: course.title },
      include: { professors: true },
    });
    if (!existing) {
      existing = await prisma.course.create({
        data: {
          title: course.title,
          description: course.description,
          acronym: course.acronym,
          professors: course.professors.length
            ? {
                connect: course.professors.map((p) => ({ id: p.id })),
              }
            : undefined,
        },
        include: { professors: true },
      });
      console.log('Course created:', { title: course.title });
    }
    courses.push(existing);
  }

  // Classes
  const classes: Array<{
    id: number;
    title: string;
    description: string;
    courseId: number;
    objectives: string | null;
    orderIndex: number;
    basePrice: number;
  }> = [];

  // Find Cálculo II course
  const calculoII = courses.find((c) => c.title === 'Cálculo II');

  // Classes for Cálculo II
  const calculoIIClasses = calculoII
    ? [
        {
          title: 'Clase 0 — Repaso Cálculo I',
          description:
            'Repaso de los conceptos fundamentales de Cálculo I necesarios para el curso.',
          objectives: `
            - Igualdades trigonométricas
            - Límites e indeterminaciones comunes
            - Regla de L'Hôpital indeterminaciones
            - Tabla de derivadas
            - Reglas de derivación: producto, cociente, regla de la cadena
            - Tabla de integrales
            - Reglas de integración: sustitución, integración por partes, fracciones parciales
          `,
          orderIndex: 0,
          basePrice: 25000,
          courseId: calculoII.id,
        },
        {
          title: 'Clase 1 — Integrales Impropias',
          description:
            'Estudio de integrales con intervalos infinitos y asíntotas verticales.',
          objectives: `
            - Integrales impropias tipo I: intervalos infinitos
            - Técnicas de resolución integrales tipo I
            - Integrales impropias tipo II: integrandos con asíntotas verticales
            - Técnicas de resolución integrales tipo II
            - Criterios de convergencia: comparación directa y en el límite
          `,
          orderIndex: 1,
          basePrice: 30000,
          courseId: calculoII.id,
        },
        {
          title: 'Clase 2 — Sucesiones y Convergencia',
          description:
            'Análisis de sucesiones numéricas y sus propiedades de convergencia.',
          objectives: `
            - Definiciones: sucesión, límite de sucesión
            - Propiedades básicas: acotamiento, monotonicidad
            - Teorema de sucesiones monótonas y acotadas
            - Inducción matemática en demostraciones de convergencia
            - Cálculo de límites de sucesiones
          `,
          orderIndex: 2,
          basePrice: 30000,
          courseId: calculoII.id,
        },
        {
          title: 'Clase 3 — Series Numéricas I',
          description:
            'Introducción a series numéricas y criterios básicos de convergencia.',
          objectives: `
            - Definición de serie: sumas parciales, convergencia y divergencia
            - Series geométricas: convergencia y suma
            - Criterio de la integral
            - Criterio de la comparación directa y en el límite
            - Series alternantes: Criterio de Leibniz
            - Convergencia absoluta vs. condicional
          `,
          orderIndex: 3,
          basePrice: 35000,
          courseId: calculoII.id,
        },
        {
          title: 'Clase 4 — Series Numéricas II',
          description:
            'Criterios avanzados de convergencia, series de potencias y Taylor.',
          objectives: `
            - Criterio de la raíz
            - Criterio del cociente (o razón)
            - Series de potencias: definición y radio de convergencia
            - Series de Taylor: desarrollo de funciones elementales
            - Resto de Taylor y convergencia de la aproximación
          `,
          orderIndex: 4,
          basePrice: 35000,
          courseId: calculoII.id,
        },
        {
          title: 'Clase 5 — Vectores y Geometría 3D',
          description:
            'Introducción a vectores en el espacio tridimensional y geometría analítica.',
          objectives: `
            - Vectores en ℝ³: magnitud, sentido, dirección
            - Operaciones: suma, producto punto, producto cruz
            - Rectas en el espacio: formas paramétrica y vectorial
            - Planos en el espacio: forma vectorial y escalar
            - Posiciones relativas: paralelismo, perpendicularidad, intersecciones
          `,
          orderIndex: 5,
          basePrice: 30000,
          courseId: calculoII.id,
        },
        {
          title: 'Clase 6 — Funciones de Varias Variables I',
          description:
            'Fundamentos de funciones de varias variables: dominio, gráficas y límites.',
          objectives: `
            - Definición de función de varias variables
            - Dominio y rango
            - Gráficas y curvas de nivel
            - Superficies cuadráticas clásicas
            - Límites y continuidad en varias variables
            - Definición derivadas parciales como límites
          `,
          orderIndex: 6,
          basePrice: 35000,
          courseId: calculoII.id,
        },
        {
          title: 'Clase 7 — Derivadas funciones de varias variables',
          description: 'Estudio de derivadas parciales y planos tangentes.',
          objectives: `
            - Derivadas parciales
            - Interpretación geométrica: pendiente direccional
            - Derivadas de orden superior
            - Teorema de Clairaut
            - Planos tangentes y aproximaciones lineales
            - Diferenciabilidad: condiciones básicas
          `,
          orderIndex: 7,
          basePrice: 35000,
          courseId: calculoII.id,
        },
        {
          title: 'Clase 8 — Regla de la Cadena y vector gradiente',
          description:
            'Regla de la cadena en varias variables y aplicaciones del gradiente.',
          objectives: `
            - Regla de la cadena en varias variables
            - Derivación implícita
            - Derivadas direccionales
            - Gradiente: interpretación como vector normal
            - Aplicaciones geométricas (planos y normales)
          `,
          orderIndex: 8,
          basePrice: 35000,
          courseId: calculoII.id,
        },
        {
          title: 'Clase 9 — Extremos de Funciones',
          description:
            'Optimización de funciones de varias variables con y sin restricciones.',
          objectives: `
            - Máximos y mínimos locales
            - Criterio de la segunda derivada
            - Matriz Hessiana
            - Extremos absolutos en dominios cerrados y acotados
            - Multiplicadores de Lagrange
            - Optimización con y sin restricciones
          `,
          orderIndex: 9,
          basePrice: 40000,
          courseId: calculoII.id,
        },
        {
          title: 'Clase 10 — Integrales Dobles',
          description: 'Introducción a integrales dobles y sus aplicaciones.',
          objectives: `
            - Definición de integral doble
            - Integrales iteradas en rectángulos
            - Regiones generales tipo I y II
            - Cambio de variables a coordenadas polares
            - Aplicaciones: cálculo de áreas y volúmenes
          `,
          orderIndex: 10,
          basePrice: 35000,
          courseId: calculoII.id,
        },
        {
          title: 'Clase 11 — Integrales Triples I',
          description: 'Integrales triples y coordenadas cilíndricas.',
          objectives: `
            - Definición de integral triple
            - Evaluación en regiones simples
            - Coordenadas cilíndricas
            - Cálculo de integrales triples con coordenadas cilíndricas
          `,
          orderIndex: 11,
          basePrice: 35000,
          courseId: calculoII.id,
        },
        {
          title: 'Clase 12 — Integrales triples II y Cambio de Variable',
          description:
            'Coordenadas esféricas, cambio de variable y aplicaciones.',
          objectives: `
            - Coordenadas esféricas
            - Cálculo de integrales triples con coordenadas esféricas
            - Aplicaciones: cálculo de volúmenes, masa
            - Transformaciones en el plano y en el espacio
            - Jacobiano y cambio de variable en integrales múltiples
          `,
          orderIndex: 12,
          basePrice: 40000,
          courseId: calculoII.id,
        },
      ]
    : [];

  // Create classes for Cálculo II
  for (const classData of calculoIIClasses) {
    let existing = await prisma.class.findFirst({
      where: { title: classData.title, courseId: classData.courseId },
    });
    if (!existing) {
      existing = await prisma.class.create({
        data: classData,
      });
      console.log('Class created:', { title: classData.title });
    }
    classes.push(existing);
  }

  // Find Cálculo I course
  const calculoI = courses.find((c) => c.title === 'Cálculo I');

  // Classes for Cálculo I
  const calculoIClasses = calculoI
    ? [
        {
          title: 'Clase 1 — Concepto de Límite',
          description:
            'Introducción al concepto de límite desde una perspectiva intuitiva y formal.',
          objectives: `
            - Concepto intuitivo y formal de límite
            - Límites laterales
            - Límites al infinito
            - Técnicas algebraicas básicas para cálculo de límites
          `,
          orderIndex: 1,
          basePrice: 28000,
          courseId: calculoI.id,
        },
        {
          title: 'Clase 2 — Continuidad de Funciones',
          description:
            'Estudio de la continuidad y sus aplicaciones fundamentales.',
          objectives: `
            - Definición de continuidad
            - Continuidad en un punto y en un intervalo
            - Teorema del Valor Intermedio
            - Aplicaciones de continuidad
          `,
          orderIndex: 2,
          basePrice: 28000,
          courseId: calculoI.id,
        },
        {
          title: 'Clase 3 — Definición de Derivada',
          description:
            'Introducción a la derivada como límite y sus interpretaciones.',
          objectives: `
            - Definición de derivada como límite
            - Interpretación geométrica: recta tangente
            - Interpretación física: velocidad instantánea
            - Cálculo de derivadas mediante definición
          `,
          orderIndex: 3,
          basePrice: 30000,
          courseId: calculoI.id,
        },
        {
          title: 'Clase 4 — Reglas de Derivación Básicas',
          description:
            'Reglas fundamentales para derivar funciones algebraicas.',
          objectives: `
            - Regla de la potencia
            - Regla del producto
            - Regla del cociente
            - Derivada de funciones polinomiales
          `,
          orderIndex: 4,
          basePrice: 30000,
          courseId: calculoI.id,
        },
        {
          title: 'Clase 5 — Regla de la Cadena',
          description:
            'Derivación de funciones compuestas mediante la regla de la cadena.',
          objectives: `
            - Concepto de función compuesta
            - Regla de la cadena
            - Aplicaciones de la regla de la cadena
            - Ejemplos combinados con otras reglas
          `,
          orderIndex: 5,
          basePrice: 32000,
          courseId: calculoI.id,
        },
        {
          title: 'Clase 6 — Derivación Implícita',
          description:
            'Técnicas para derivar funciones definidas implícitamente.',
          objectives: `
            - Concepto de función implícita
            - Técnica de derivación implícita
            - Aplicaciones geométricas
            - Ejercicios con ecuaciones implícitas
          `,
          orderIndex: 6,
          basePrice: 30000,
          courseId: calculoI.id,
        },
        {
          title: 'Clase 7 — Derivadas de Funciones Trascendentes',
          description:
            'Derivadas de funciones trigonométricas, exponenciales y logarítmicas.',
          objectives: `
            - Derivadas de funciones trigonométricas
            - Derivada de función exponencial
            - Derivada de función logarítmica
            - Aplicaciones combinadas
          `,
          orderIndex: 7,
          basePrice: 32000,
          courseId: calculoI.id,
        },
        {
          title: 'Clase 8 — Análisis de Funciones I',
          description:
            'Uso de derivadas para analizar el comportamiento de funciones.',
          objectives: `
            - Crecimiento y decrecimiento de funciones
            - Máximos y mínimos relativos
            - Criterio de la primera derivada
            - Problemas de aplicación
          `,
          orderIndex: 8,
          basePrice: 35000,
          courseId: calculoI.id,
        },
        {
          title: 'Clase 9 — Análisis de Funciones II',
          description:
            'Concavidad, puntos de inflexión y criterio de la segunda derivada.',
          objectives: `
            - Concavidad de funciones
            - Puntos de inflexión
            - Criterio de la segunda derivada
            - Análisis completo de funciones
          `,
          orderIndex: 9,
          basePrice: 35000,
          courseId: calculoI.id,
        },
        {
          title: 'Clase 10 — Problemas de Optimización',
          description:
            'Aplicación de derivadas en problemas de optimización reales.',
          objectives: `
            - Modelamiento de problemas de optimización
            - Máximos y mínimos absolutos
            - Estrategias de resolución
            - Problemas aplicados de ingeniería
          `,
          orderIndex: 10,
          basePrice: 38000,
          courseId: calculoI.id,
        },
        {
          title: 'Clase 11 — Teoremas Fundamentales',
          description: 'Teoremas importantes del cálculo diferencial.',
          objectives: `
            - Teorema de Rolle
            - Teorema del Valor Medio
            - Regla de L'Hôpital
            - Aplicaciones de los teoremas
          `,
          orderIndex: 11,
          basePrice: 35000,
          courseId: calculoI.id,
        },
        {
          title: 'Clase 12 — Antiderivadas e Integrales Indefinidas',
          description:
            'Introducción al concepto de antiderivada e integral indefinida.',
          objectives: `
            - Concepto de antiderivada
            - Integrales indefinidas
            - Tabla básica de integrales
            - Propiedades de la integral indefinida
          `,
          orderIndex: 12,
          basePrice: 32000,
          courseId: calculoI.id,
        },
        {
          title: 'Clase 13 — Teorema Fundamental del Cálculo',
          description: 'Conexión entre derivadas e integrales mediante el TFC.',
          objectives: `
            - Primera parte del Teorema Fundamental del Cálculo
            - Segunda parte del Teorema Fundamental del Cálculo
            - Interpretación geométrica
            - Aplicaciones del teorema
          `,
          orderIndex: 13,
          basePrice: 35000,
          courseId: calculoI.id,
        },
        {
          title: 'Clase 14 — Integrales Definidas',
          description:
            'Cálculo de integrales definidas y su interpretación geométrica.',
          objectives: `
            - Definición de integral definida
            - Interpretación geométrica: área bajo la curva
            - Propiedades de la integral definida
            - Cálculo de áreas
          `,
          orderIndex: 14,
          basePrice: 35000,
          courseId: calculoI.id,
        },
        {
          title: 'Clase 15 — Técnicas de Integración Básicas',
          description: 'Técnicas fundamentales para calcular integrales.',
          objectives: `
            - Sustitución simple
            - Integración de funciones trigonométricas básicas
            - Integración de funciones exponenciales y logarítmicas
            - Estrategias de resolución
          `,
          orderIndex: 15,
          basePrice: 35000,
          courseId: calculoI.id,
        },
      ]
    : [];

  // Create classes for Cálculo I
  for (const classData of calculoIClasses) {
    let existing = await prisma.class.findFirst({
      where: { title: classData.title, courseId: classData.courseId },
    });
    if (!existing) {
      existing = await prisma.class.create({
        data: classData,
      });
      console.log('Class created:', { title: classData.title });
    }
    classes.push(existing);
  }

  // Find Optimización course
  const optimizacion = courses.find((c) => c.title === 'Optimización');

  // Classes for Optimización
  const optimizacionClasses = optimizacion
    ? [
        {
          title: 'Clase 1 — Modelación I',
          description:
            'Fundamentos de modelación matemática para problemas de optimización.',
          objectives: `
            - Identificación de variables de decisión, conjuntos, parámetros y restricciones
            - Construcción de la función objetivo a partir de problemas reales
            - Tipos de variables: continuas, enteras, binarias
            - Tipos de restricciones: Big-M, exclusión, máximo de días seguidos
          `,
          orderIndex: 1,
          basePrice: 35000,
          courseId: optimizacion.id,
        },
        {
          title: 'Clase 2 — Modelación II',
          description:
            'Modelación avanzada con múltiples restricciones y problemas complejos.',
          objectives: `
            - Modelos con múltiples restricciones
            - Problemas de distribución
            - Problemas de asignación
            - Problemas de exclusión
          `,
          orderIndex: 2,
          basePrice: 35000,
          courseId: optimizacion.id,
        },
        {
          title: 'Clase 3 — Fundamentos Matemáticos',
          description:
            'Bases teóricas que sustentan la optimización matemática.',
          objectives: `
            - Teorema de Bolzano–Weierstrass: existencia de puntos de acumulación
            - Condiciones de existencia de soluciones
            - Definición de convexidad: funciones convexas, conjuntos convexos
            - Propiedades de convexidad y soluciones globales
            - Modelos equivalentes
          `,
          orderIndex: 3,
          basePrice: 38000,
          courseId: optimizacion.id,
        },
        {
          title: 'Clase 4 — Programación Lineal y Geometría Poliédrica',
          description:
            'Introducción a programación lineal y su geometría asociada.',
          objectives: `
            - Definición de programación lineal (PL) en forma estándar
            - Geometría de poliedros: conjunto factible
            - Poliedros y politopos
            - Concepto de rayos de escape
            - Relación entre vértices y soluciones óptimas
          `,
          orderIndex: 4,
          basePrice: 38000,
          courseId: optimizacion.id,
        },
        {
          title: 'Clase 5 — Método Simplex (Fase II)',
          description:
            'Algoritmo simplex para resolver problemas de programación lineal.',
          objectives: `
            - Idea del algoritmo: recorrer vértices del poliedro factible
            - Construcción de la tabla simplex
            - Regla de pivoteo: variable entrante y saliente
            - Criterios de optimalidad
          `,
          orderIndex: 5,
          basePrice: 40000,
          courseId: optimizacion.id,
        },
        {
          title: 'Clase 6 — Método Simplex: Casos Especiales y Fase I',
          description:
            'Casos especiales del simplex y método para encontrar solución inicial.',
          objectives: `
            - Degeneración y ciclo
            - Múltiples soluciones óptimas
            - Problemas acotados y no acotados
            - Inexistencia de solución factible
            - Método de la Fase I
          `,
          orderIndex: 6,
          basePrice: 40000,
          courseId: optimizacion.id,
        },
        {
          title: 'Clase 7 — Análisis Postóptimo y Dualidad',
          description:
            'Análisis de sensibilidad y teoría de dualidad en programación lineal.',
          objectives: `
            - Sensibilidad: variaciones de coeficientes
            - Análisis de rango en coeficientes de función objetivo
            - Definición del problema dual
            - Interpretación económica de variables duales (precios sombra)
            - Teorema de dualidad fuerte y débil
          `,
          orderIndex: 7,
          basePrice: 42000,
          courseId: optimizacion.id,
        },
        {
          title: 'Clase 8 — Programación Entera',
          description:
            'Optimización con variables enteras y algoritmos de resolución.',
          objectives: `
            - Introducción a problemas con variables enteras
            - Diferencia entre PL continua y entera
            - Método de branch and bound
            - Algoritmos de cortes de Gomory
          `,
          orderIndex: 8,
          basePrice: 42000,
          courseId: optimizacion.id,
        },
        {
          title: 'Clase 9 — Optimización No Lineal Irrestricta',
          description:
            'Fundamentos de optimización no lineal sin restricciones.',
          objectives: `
            - Definición de problemas no lineales
            - Condiciones de optimalidad de primer y segundo orden
            - Métodos de búsqueda: descenso más pronunciado, Newton
            - Propiedades de convexidad en funciones no lineales
          `,
          orderIndex: 9,
          basePrice: 40000,
          courseId: optimizacion.id,
        },
        {
          title: 'Clase 10 — Optimización No Lineal Restringida',
          description:
            'Optimización no lineal con restricciones de igualdad y desigualdad.',
          objectives: `
            - Incorporación de restricciones de igualdad y desigualdad
            - Multiplicadores de Lagrange y condiciones KKT
            - Interpretación de multiplicadores como precios sombra
            - Métodos de resolución
            - Diferencias entre problemas convexos y no convexos
          `,
          orderIndex: 10,
          basePrice: 45000,
          courseId: optimizacion.id,
        },
      ]
    : [];

  // Create classes for Optimización
  for (const classData of optimizacionClasses) {
    let existing = await prisma.class.findFirst({
      where: { title: classData.title, courseId: classData.courseId },
    });
    if (!existing) {
      existing = await prisma.class.create({
        data: classData,
      });
      console.log('Class created:', { title: classData.title });
    }
    classes.push(existing);
  }

  // Find Electricidad y Magnetismo course
  const electromagnetismo = courses.find(
    (c) => c.title === 'Electricidad y Magnetismo'
  );

  // Classes for Electricidad y Magnetismo
  const electromagnetismoClasses = electromagnetismo
    ? [
        {
          title: 'Clase 1 — Carga, Fuerza Eléctrica y Campo Eléctrico',
          description:
            'Fundamentos de la electrostática: carga, fuerza de Coulomb y campo eléctrico.',
          objectives: `
            - Concepto de carga eléctrica: naturaleza, tipos y conservación
            - Ley de Coulomb: interacción entre cargas puntuales
            - Principio de superposición para fuerzas eléctricas
            - Definición de campo eléctrico como fuerza por unidad de carga
            - Campo eléctrico de una carga puntual
            - Representación con líneas de campo
          `,
          orderIndex: 1,
          basePrice: 32000,
          courseId: electromagnetismo.id,
        },
        {
          title: 'Clase 2 — Campo Eléctrico y Distribuciones de Carga',
          description:
            'Cálculo de campos eléctricos en distribuciones de carga discretas y continuas.',
          objectives: `
            - Superposición aplicada a sistemas con múltiples cargas
            - Diferencia entre distribuciones discretas y continuas
            - Densidad de carga: lineal, superficial y volumétrica
            - Método integral para calcular campos de distribuciones
            - Fuerza eléctrica sobre una distribución de carga
          `,
          orderIndex: 2,
          basePrice: 35000,
          courseId: electromagnetismo.id,
        },
        {
          title: 'Clase 3 — Flujo, Ley de Gauss y Potencial Eléctrico',
          description: 'Ley de Gauss y su aplicación a problemas con simetría.',
          objectives: `
            - Concepto de flujo eléctrico a través de una superficie
            - Ley de Gauss y su vínculo con la carga encerrada
            - Identificación de casos con simetría
            - Criterios para decidir entre Gauss o integración directa
            - Definición de potencial eléctrico y relación con el campo
          `,
          orderIndex: 3,
          basePrice: 35000,
          courseId: electromagnetismo.id,
        },
        {
          title: 'Clase 4 — Energía, Trabajo y Potencial Eléctrico',
          description:
            'Energía potencial eléctrica, trabajo y superficies equipotenciales.',
          objectives: `
            - Trabajo realizado por una fuerza eléctrica
            - Relación entre energía potencial eléctrica y potencial
            - Distinción entre variación de energía potencial y trabajo
            - Energía de un sistema de cargas
            - Superficies equipotenciales y su interpretación
            - Campo eléctrico como campo conservativo
          `,
          orderIndex: 4,
          basePrice: 35000,
          courseId: electromagnetismo.id,
        },
        {
          title: 'Clase 5 — Conductores y Capacitancia',
          description:
            'Propiedades de conductores en equilibrio y capacitores.',
          objectives: `
            - Propiedades de los conductores en equilibrio electrostático
            - Distribución de carga y campo en el interior de un conductor
            - Definición de capacitancia y cálculo para geometrías simples
            - Energía almacenada en un capacitor
            - Asociación de capacitores en serie y paralelo
          `,
          orderIndex: 5,
          basePrice: 35000,
          courseId: electromagnetismo.id,
        },
        {
          title: 'Clase 6 — Capacitores con Dieléctricos',
          description: 'Efecto de los dieléctricos sobre la capacitancia.',
          objectives: `
            - Definición de dieléctrico y efecto sobre la capacitancia
            - Polarización y campo en el interior del material
            - Densidad de carga libre y de carga inducida
            - Aplicación de la Ley de Gauss en dieléctricos
            - Cálculo de capacitancia con dieléctricos
          `,
          orderIndex: 6,
          basePrice: 35000,
          courseId: electromagnetismo.id,
        },
        {
          title: 'Clase 7 — Intensidad de Corriente y Ley de Ohm',
          description:
            'Corriente eléctrica, resistividad y ley de Ohm microscópica.',
          objectives: `
            - Resistividad y resistencia de materiales
            - Definición del vector densidad de corriente
            - Corriente como flujo de carga a través de una sección
            - Ley de Ohm microscópica: relación entre campo eléctrico y corriente
            - Cálculo diferencial de resistencias
          `,
          orderIndex: 7,
          basePrice: 32000,
          courseId: electromagnetismo.id,
        },
        {
          title: 'Clase 8 — Leyes de Kirchhoff y Circuitos',
          description: 'Análisis de circuitos mediante las leyes de Kirchhoff.',
          objectives: `
            - Ley de corrientes (nodos) y ley de tensiones (mallas)
            - Procedimiento sistemático para resolver circuitos
            - Ley de Ohm macroscópica en resistores
            - Reducción de resistores en serie y paralelo
            - Asociación y equivalencia de capacitores
          `,
          orderIndex: 8,
          basePrice: 35000,
          courseId: electromagnetismo.id,
        },
        {
          title: 'Clase 9 — Circuito RC',
          description: 'Carga y descarga de capacitores en circuitos RC.',
          objectives: `
            - Proceso de carga y descarga de un capacitor
            - Ecuaciones diferenciales y solución exponencial
            - Constante de tiempo (τ) y su interpretación física
          `,
          orderIndex: 9,
          basePrice: 35000,
          courseId: electromagnetismo.id,
        },
        {
          title: 'Clase 10 — Fuerza de Lorentz',
          description:
            'Introducción al magnetismo y fuerza sobre cargas en movimiento.',
          objectives: `
            - Definición de la fuerza de Lorentz
            - Movimiento circular uniforme en un campo magnético
            - Trayectorias helicoidales: radio, paso y frecuencia
            - Fuerza magnética sobre corrientes en conductores
          `,
          orderIndex: 10,
          basePrice: 35000,
          courseId: electromagnetismo.id,
        },
        {
          title: 'Clase 11 — Ley de Biot–Savart y Ley de Ampère',
          description:
            'Cálculo de campos magnéticos mediante Biot-Savart y Ampère.',
          objectives: `
            - Campo magnético a partir de la ley de Biot–Savart
            - Aplicaciones de la ley de Ampère en geometrías simétricas
            - Comparación entre ambos métodos y criterios de uso
          `,
          orderIndex: 11,
          basePrice: 38000,
          courseId: electromagnetismo.id,
        },
        {
          title: 'Clase 12 — Ley de Faraday–Lenz e Inducción',
          description: 'Inducción electromagnética y leyes de Faraday y Lenz.',
          objectives: `
            - Ley de Faraday: fem inducida por cambio de flujo magnético
            - Ley de Lenz y el principio de oposición
            - Concepto de autoinducción e inductancia mutua
          `,
          orderIndex: 12,
          basePrice: 38000,
          courseId: electromagnetismo.id,
        },
        {
          title: 'Clase 13 — Circuito RLC',
          description:
            'Análisis de circuitos con resistencia, inductancia y capacitancia.',
          objectives: `
            - Circuitos con resistencia, inductancia y capacitancia
            - Ecuaciones diferenciales y soluciones generales
            - Régimen subamortiguado, crítico y sobreamortiguado
            - Condiciones de resonancia en circuitos RLC
          `,
          orderIndex: 13,
          basePrice: 40000,
          courseId: electromagnetismo.id,
        },
        {
          title: 'Clase 14 — Ondas Electromagnéticas',
          description:
            'Propagación de ondas electromagnéticas y ecuaciones de Maxwell.',
          objectives: `
            - Concepto de onda electromagnética
            - Relación entre campo eléctrico y magnético en propagación
            - Velocidad de propagación y energía asociada
            - Ondas planas en el vacío a partir de Maxwell
            - Aplicaciones generales de ondas electromagnéticas
          `,
          orderIndex: 14,
          basePrice: 40000,
          courseId: electromagnetismo.id,
        },
      ]
    : [];

  // Create classes for Electricidad y Magnetismo
  for (const classData of electromagnetismoClasses) {
    let existing = await prisma.class.findFirst({
      where: { title: classData.title, courseId: classData.courseId },
    });
    if (!existing) {
      existing = await prisma.class.create({
        data: classData,
      });
      console.log('Class created:', { title: classData.title });
    }
    classes.push(existing);
  }

  // Find Dinámica course
  const dinamica = courses.find((c) => c.title === 'Dinámica');

  // Classes for Dinámica
  const dinamicaClasses = dinamica
    ? [
        {
          title: 'Clase 0 — Herramientas Matemáticas',
          description:
            'Fundamentos matemáticos necesarios para el curso de dinámica.',
          objectives: `
            - Vectores: definiciones, magnitud, dirección y operaciones
            - Sistemas de coordenadas: cartesianas, polares y cilíndricas
            - Derivadas: regla de la cadena, derivadas de funciones vectoriales
            - Integración: integración por partes y separación de variables
            - Ecuaciones diferenciales simples aplicadas a movimiento
          `,
          orderIndex: 0,
          basePrice: 25000,
          courseId: dinamica.id,
        },
        {
          title: 'Clase 1 — Cinemática I: Movimiento en 1D y 2D',
          description: 'Descripción del movimiento en una y dos dimensiones.',
          objectives: `
            - Posición, desplazamiento, velocidad y aceleración en 1D
            - Movimiento rectilíneo uniforme y uniformemente acelerado
            - Caída libre y lanzamiento vertical
            - Movimiento parabólico y proyectiles en 2D
            - Uso de gráficas x–t, v–t y a–t
          `,
          orderIndex: 1,
          basePrice: 30000,
          courseId: dinamica.id,
        },
        {
          title: 'Clase 2 — Cinemática II: Coordenadas Curvilíneas',
          description: 'Movimiento en coordenadas polares y cilíndricas.',
          objectives: `
            - Vectores unitarios en polares y cilíndricas
            - Componentes radial y transversal de velocidad y aceleración
            - Componentes axial y tangencial
            - Aceleración centrípeta en movimiento circular uniforme
            - Movimiento circular no uniforme
          `,
          orderIndex: 2,
          basePrice: 32000,
          courseId: dinamica.id,
        },
        {
          title: 'Clase 3 — Leyes de Newton I',
          description:
            'Introducción a las leyes de Newton y fuerzas fundamentales.',
          objectives: `
            - Formulación de las tres Leyes de Newton
            - Diagramas de cuerpo libre (DCL) como herramienta central
            - Fuerzas fundamentales: peso y normal
            - Rozamiento estático y cinético
            - Problemas de superficie horizontal e inclinada
          `,
          orderIndex: 3,
          basePrice: 32000,
          courseId: dinamica.id,
        },
        {
          title: 'Clase 4 — Leyes de Newton II',
          description: 'Fuerzas elásticas, poleas y sistemas conectados.',
          objectives: `
            - Fuerza elástica (Ley de Hooke)
            - Poleas y ligaduras: vínculos de movimiento
            - Tensión en cuerdas y su transmisión
            - Aplicación de Newton a sistemas conectados
          `,
          orderIndex: 4,
          basePrice: 35000,
          courseId: dinamica.id,
        },
        {
          title: 'Clase 5 — Trabajo, Energía y Potencial',
          description: 'Conceptos de trabajo, energía cinética y potencial.',
          objectives: `
            - Definición de trabajo como producto fuerza y desplazamiento
            - Teorema trabajo–energía: ΔK = W
            - Fuerzas conservativas y energía potencial asociada
            - Potencial gravitatorio y potencial elástico
            - Conservación de la energía mecánica
          `,
          orderIndex: 5,
          basePrice: 35000,
          courseId: dinamica.id,
        },
        {
          title: 'Clase 6 — Potencia y Oscilaciones',
          description: 'Potencia mecánica y movimiento armónico simple.',
          objectives: `
            - Potencia: instantánea y media
            - Oscilador armónico simple (MAS): ecuación y solución
            - Energía cinética y potencial en el MAS
            - Consideraciones de fase y representación gráfica
          `,
          orderIndex: 6,
          basePrice: 35000,
          courseId: dinamica.id,
        },
        {
          title: 'Clase 7 — Impulso y Cantidad de Movimiento',
          description: 'Impulso, momento lineal y conservación en colisiones.',
          objectives: `
            - Definición de impulso y relación con momento lineal
            - Conservación de la cantidad de movimiento
            - Aplicación a colisiones unidimensionales
            - Diferencia entre colisiones elásticas e inelásticas
          `,
          orderIndex: 7,
          basePrice: 35000,
          courseId: dinamica.id,
        },
        {
          title: 'Clase 8 — Colisiones y Sistemas de Masa Variable',
          description:
            'Colisiones bidimensionales y sistemas con masa variable.',
          objectives: `
            - Colisiones en dos dimensiones
            - Choques oblicuos y análisis de resultados
            - Introducción a sistemas de masa variable
            - Ejemplos físicos: cohetes, cadenas, chorros de fluido
          `,
          orderIndex: 8,
          basePrice: 38000,
          courseId: dinamica.id,
        },
        {
          title: 'Clase 9 — Cuerpo Rígido: Centro de Masa y Torque',
          description: 'Introducción al movimiento de cuerpos rígidos.',
          objectives: `
            - Definición de centro de masa
            - Cálculo para sistemas discretos y continuos
            - Relación del centro de masa con el movimiento del sistema
            - Definición de torque (momento de una fuerza)
            - Interpretación física del torque
          `,
          orderIndex: 9,
          basePrice: 35000,
          courseId: dinamica.id,
        },
        {
          title: 'Clase 10 — Rotación y Momento de Inercia',
          description: 'Cinemática angular y dinámica rotacional.',
          objectives: `
            - Cinemática angular: ω y α
            - Analogías traslacionales y rotacionales
            - Definición de momento de inercia
            - Cálculo de momentos de inercia y teorema de ejes paralelos
            - Segunda Ley de Newton para rotación: Στ = I·α
          `,
          orderIndex: 10,
          basePrice: 38000,
          courseId: dinamica.id,
        },
        {
          title: 'Clase 11 — Momento Angular y Energía Rotacional',
          description: 'Momento angular, su conservación y energía rotacional.',
          objectives: `
            - Definición de momento angular (L = r × p)
            - Conservación del momento angular
            - Relación entre torque y variación del momento angular
            - Energía cinética rotacional: Krot = ½ Iω²
            - Trabajo y potencia en sistemas rotacionales
          `,
          orderIndex: 11,
          basePrice: 38000,
          courseId: dinamica.id,
        },
        {
          title: 'Clase 12 — Rodado y Rotación + Traslación',
          description: 'Movimiento combinado de traslación y rotación.',
          objectives: `
            - Condición de rodado sin deslizamiento
            - Punto instantáneo de rotación
            - Energía total en sistemas con traslación y rotación
            - Colisiones que involucran rotación e impulso angular
          `,
          orderIndex: 12,
          basePrice: 40000,
          courseId: dinamica.id,
        },
        {
          title: 'Clase 13 — Síntesis de Métodos y Problemas Integradores',
          description: 'Integración de conceptos y estrategias de resolución.',
          objectives: `
            - Estrategias para elegir entre Newton, Energía o Momento
            - Revisión de conexiones entre cinemática, dinámica, energía y rotación
            - Problemas que combinan varios métodos y conceptos
            - Técnicas de examen y errores comunes
          `,
          orderIndex: 13,
          basePrice: 40000,
          courseId: dinamica.id,
        },
      ]
    : [];

  // Create classes for Dinámica
  for (const classData of dinamicaClasses) {
    let existing = await prisma.class.findFirst({
      where: { title: classData.title, courseId: classData.courseId },
    });
    if (!existing) {
      existing = await prisma.class.create({
        data: classData,
      });
      console.log('Class created:', { title: classData.title });
    }
    classes.push(existing);
  }

  // For other courses, create generic classes (if any remain)
  for (const course of courses) {
    if (
      course.title === 'Cálculo II' ||
      course.title === 'Cálculo I' ||
      course.title === 'Optimización' ||
      course.title === 'Electricidad y Magnetismo' ||
      course.title === 'Dinámica'
    )
      continue; // Skip, already created

    // for (let j = 1; j <= 2; j++) {
    //   const title = `${course.title} - Clase ${j}`;
    //   let existing = await prisma.class.findFirst({
    //     where: { title, courseId: course.id },
    //   });
    //   if (!existing) {
    //     existing = await prisma.class.create({
    //       data: {
    //         title,
    //         description: `Descripción de la clase ${j} del curso ${course.title}`,
    //         objectives: `Objetivos de la clase ${j}`,
    //         orderIndex: j,
    //         basePrice: 30000,
    //         courseId: course.id,
    //       },
    //     });
    //     console.log('Class created:', { title });
    //   }
    //   classes.push(existing);
    // }
  }

  // Slots
  const slots: Array<{
    id: number;
    professorId: number;
    classId: number;
    startTime: Date;
    endTime: Date;
    modality: string;
    status: string;
    minStudents: number | null;
    maxStudents: number;
  }> = [];
  for (const [i, classObj] of classes.entries()) {
    // Get the course for this class
    const course = courses.find((c) => c.id === classObj.courseId);
    // Only create slots if the course has at least one professor assigned
    if (!course || !course.professors || course.professors.length === 0)
      continue;

    for (let k = 0; k < 2; k++) {
      // Generate random start time between 9:00 and 21:00 today
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      // Pick a random day in the current month
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const randomDay = Math.floor(Math.random() * daysInMonth) + 1;
      const minHour = 9;
      const maxHour = 21;
      const randomHour =
        Math.floor(Math.random() * (maxHour - minHour + 1)) + minHour;
      const randomMinute = Math.floor(Math.random() * 60);
      const startTime = new Date(
        currentYear,
        currentMonth,
        randomDay,
        randomHour,
        randomMinute,
        0,
        0
      );
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration
      const modality = k % 2 === 0 ? SlotModality.remote : SlotModality.onsite;
      const studentsGroup =
        k % 3 === 0 ? SlotStudentsGroup.group : SlotStudentsGroup.private;
      const location = modality === SlotModality.remote ? 'online' : 'sala A1';
      const status = 'candidate';
      const minStudents = 1;
      const maxStudents = 10;
      // Pick a random professor from the course's professors
      const professorId =
        course.professors[Math.floor(Math.random() * course.professors.length)]
          .id;
      let existing = await prisma.slot.findFirst({
        where: { classId: classObj.id, startTime },
      });
      if (!existing) {
        existing = await prisma.slot.create({
          data: {
            classId: classObj.id,
            professorId,
            startTime,
            endTime,
            modality,
            studentsGroup,
            location,
            status,
            minStudents,
            maxStudents,
            // Ensure seed-dev creates a link when DB default isn't available
            link: require('crypto').randomUUID(),
          },
        });
        console.log('Slot created:', { classId: classObj.id, startTime });
      }
      slots.push(existing);
    }
  }

  // Reservations
  for (const slot of slots) {
    for (const student of students) {
      let existing = await prisma.reservation.findFirst({
        where: { slotId: slot.id, studentId: student.id },
      });
      if (!existing) {
        // Find the course for this slot
        const slotClass = classes.find((c) => c.id === slot.classId);
        const courseForSlot = courses.find((c) => c.id === slotClass?.courseId);

        // Check if student is already enrolled in the course
        if (courseForSlot) {
          const studentInCourse = await prisma.course.findFirst({
            where: {
              id: courseForSlot.id,
              students: {
                some: { id: student.id },
              },
            },
          });

          // If not enrolled, enroll the student
          if (!studentInCourse) {
            await prisma.course.update({
              where: { id: courseForSlot.id },
              data: {
                students: {
                  connect: { id: student.id },
                },
              },
            });
            console.log('Student enrolled in course:', {
              studentId: student.id,
              courseId: courseForSlot.id,
              courseTitle: courseForSlot.title,
            });
          }
        }

        // Create a payment with random status and associate to reservation
        const slotClassForAmount = classes.find((c) => c.id === slot.classId);
        const amount = slotClassForAmount?.basePrice ?? 0;
        const paymentStatuses: PaymentStatus[] = [
          PaymentStatus.pending,
          PaymentStatus.paid,
          PaymentStatus.failed,
          PaymentStatus.refunded,
        ];
        const randomStatus =
          paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];

        const payment = await prisma.payment.create({
          data: {
            studentId: student.id,
            amount,
            currency: 'CLP',
            status: randomStatus,
            paymentProvider: 'seed',
            transactionReference: `SEED-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
          },
        });

        // Create the reservation linked to the payment
        existing = await prisma.reservation.create({
          data: {
            slotId: slot.id,
            studentId: student.id,
            status: 'pending',
            paymentId: payment.id,
          },
        });
        console.log('Reservation created:', {
          slotId: slot.id,
          studentId: student.id,
        });
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
