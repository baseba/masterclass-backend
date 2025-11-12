import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting to add "Clase Libre" to all courses...');

  // Get all courses
  const courses = await prisma.course.findMany({
    include: {
      classes: {
        orderBy: {
          orderIndex: 'desc',
        },
        take: 1,
      },
    },
  });

  console.log(`Found ${courses.length} courses`);

  for (const course of courses) {
    // Calculate the next orderIndex (last + 1)
    const lastOrderIndex =
      course.classes.length > 0 ? course.classes[0].orderIndex : -1;
    const newOrderIndex = lastOrderIndex + 1;

    // Check if "Clase Libre" already exists for this course
    const existingFreeClass = await prisma.class.findFirst({
      where: {
        courseId: course.id,
        title: 'Clase Libre',
      },
    });

    if (existingFreeClass) {
      console.log(
        `"Clase Libre" already exists for course: ${course.title} (${course.acronym})`
      );
      continue;
    }

    // Create the "Clase Libre" class
    const freeClass = await prisma.class.create({
      data: {
        courseId: course.id,
        title: 'Clase Libre',
        description:
          'Clase libre para consultas generales, dudas específicas o temas a solicitud del estudiante.',
        objectives:
          'Resolver dudas puntuales, repasar contenidos específicos o profundizar en temas de interés del estudiante.',
        orderIndex: newOrderIndex,
        basePrice: 11000, // Default base price
      },
    });

    console.log(
      `Created "Clase Libre" for course: ${course.title} (${course.acronym}) with orderIndex: ${newOrderIndex}`
    );
  }

  console.log('Finished adding "Clase Libre" to all courses');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
