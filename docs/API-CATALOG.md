# INDEC API catalog (from https://api.indec.gob.ar/api/openapi?v=2)
Base: https://api.indec.gob.ar/v1/ — PostgREST. Auth: `Authorization: Bearer $INDEC_API_KEY` (JWT, role basic, expires ~2027-05-01). Filters: PostgREST syntax e.g. `?periodo=gte.202401&order=periodo.desc&limit=100&select=a,b`.

## /ipi_manufacturero
Tag: ['Dirección de Estadísticas Mineras, Manufactureras, Energéticas y de la Construcción']
Índice de producción industrial manufacturero (IPI manufacturero), nivel general y aperturas por actividad económica, base 2004=100. Incluye las series original, desestacionalizada y tendencia-ciclo, expresadas como números índice y variaciones porcentuales.
 
Este endpoint contiene información desde enero de 2016.
 
Para más información, se puede consultar la metodología INDEC N° 31, Metodología del índice de producción industrial manufacturero, a través del siguiente enlace: https://www.indec.gob.ar/ftp/cuadros/economia/metodologia_ipi_manufacturero_2019.pdf

### Ejemplos de uso para esta tabla

- **Obtener todo (paginado):**
  `GET /ipi_manufacturero?order=periodo,indicador,cuadro_web,cod
Params: periodo, anio, mes, indicador, cuadro_web, codigo_CLaNAE_2004, descripcion, serie, tipo_de_indicador, unidad_de_medida, valor

## /ipi_minero
Tag: ['Dirección de Estadísticas Mineras, Manufactureras, Energéticas y de la Construcción']
IPI minero nivel general. Series original, desestacionalizada y tendencia-ciclo, base 2016=100. Este endpoint contiene información desde enero de 2017. Para más información, se puede consultar la metodología INDEC N° 41, Índice de producción industrial minero, a través del siguiente enlace: https://www.indec.gob.ar/ftp/cuadros/economia/metodologia_ipi_minero.pdf


### Ejemplos de uso para esta tabla

- **Obtener todo (paginado):**
  `GET /ipi_minero?order=periodo,anio,mes,indicador,cuadro_web,codigo_ClaNAE_2010,codigo_CPC_2_1,serie,descripcion,tipo_de_indicador,unidad_de_medida&limit=1000&offset=0`
- **Buscar texto en periodo (contiene 'valor'):**
                      `GET /ipi_minero?perio
Params: periodo, anio, mes, indicador, cuadro_web, codigo_ClaNAE_2010, codigo_CPC_2_1, serie, descripcion, tipo_de_indicador, unidad_de_medida, valor

## /estimaciones_poblacion_departamento_2022_2035
Tag: ['Dirección de Estadísticas Poblacionales']
Estimaciones de población al 1° de julio de cada año calendario, por sexo y departamento, con base en el Censo Nacional de Población, Hogares y Viviendas 2022. Años 2022-2035.   

Para más información, se pueden consultar la siguiente documentación metodológica:  
https://www.indec.gob.ar/ftp/cuadros/publicaciones/estimaciones_departamentos_2022_2035.pdf  

### Ejemplos de uso para esta tabla

- **Obtener todo (paginado):**
  `GET /estimaciones_poblacion_departamento_2022_2035?order=departamento_cod,sexo_cod,fecha&limit=1000&offset=0`
- **Buscar texto en jurisdiccion_cod (contiene 'valor'):**
                      `GET /estimaciones_poblacion_departamento_2022_2035?jurisdiccion_cod=ilike.*va
Params: jurisdiccion_cod, jurisdiccion_nom, departamento_cod, departamento_nom, rmba, sexo_cod, sexo_nom, poblacion, fecha

## /proyecciones_poblacion_jurisdiccion_2022_2040
Tag: ['Dirección de Estadísticas Poblacionales']
Estimaciones y proyecciones de población al 1° de julio de cada año calendario, por sexo y grupos de edad, con base en el Censo Nacional de Población, Hogares y Viviendas 2022. Jurisdicciones. Años 2022-2040.   

Para más información, se pueden consultar la siguiente documentación metodológica: https://www.indec.gob.ar/ftp/cuadros/publicaciones/proyecciones_jurisdicciones_2022_2040.pdf


### Ejemplos de uso para esta tabla

- **Obtener todo (paginado):**
  `GET /proyecciones_poblacion_jurisdiccion_2022_2040?order=jurisdiccion_cod,sexo_cod,edad_cod,fecha&limit=1000&offset=0`
- **Buscar texto en jurisdiccion_cod (contiene 'valor'):**
                      `GET /proyecciones_poblacion_jurisdicc
Params: jurisdiccion_cod, jurisdiccion_nom, sexo_cod, sexo_nom, edad_cod, edad_nom, poblacion, fecha

## /proyecciones_poblacion_nacional_2022_2040
Tag: ['Dirección de Estadísticas Poblacionales']
Estimaciones y proyecciones de población al 1° de julio de cada año calendario, por sexo y edad, con base en el Censo Nacional de Población, Hogares y Viviendas 2022. Total del país. Años 2022-2040.   

Para más información, se pueden consultar la siguiente documentación metodológica: https://www.indec.gob.ar/ftp/cuadros/publicaciones/proyecciones_nacionales_2022_2040.pdf

### Ejemplos de uso para esta tabla

- **Obtener todo (paginado):**
  `GET /proyecciones_poblacion_nacional_2022_2040?order=edad,sexo_cod,fecha&limit=1000&offset=0`
- **Filtrar por edad mayor a 100:**
                          `GET /proyecciones_poblacion_nacional_2022_2040?edad=gt.100`
- **Buscar texto en sexo_cod (contie
Params: edad, sexo_cod, sexo_nom, poblacion, fecha

## /valorizacion_canastas_cba_cbt
Tag: ['Dirección de Índices de Precios de Consumo']
Valorización mensual de la canasta básica alimentaria (CBA) y de la canasta básica total (CBT) desde abril de 2016. Gran Buenos Aires.
Para más información, se puede consultar la metodología INDEC N° 22, La medición de la pobreza y la indigencia en la Argentina, a través del siguiente enlace: https://www.indec.gob.ar/ftp/cuadros/sociedad/EPH_metodologia_22_pobreza.pdf

### Ejemplos de uso para esta tabla

- **Obtener todo (paginado):**
  `GET /valorizacion_canastas_cba_cbt?order=clasificador,nivel,codigo,descripcion,periodo,anio,mes,indicador,tipo_de_indicador,tipo_de_indicador_descripcion,region,unidad_de_medida&limit=1000&offset=0`
- **Buscar texto en clasificador (contiene 'valor'):**
   
Params: clasificador, nivel, codigo, descripcion, periodo, anio, mes, indicador, tipo_de_indicador, tipo_de_indicador_descripcion, region, unidad_de_medida, valor, observaciones

## /ipc_nacional
Tag: ['Dirección de Índices de Precios de Consumo']
Índice de precios al consumidor (IPC) de la República Argentina, con aperturas por región, división, grupo, clase y subclase, desde diciembre de 2016.
Para más información, se puede consultar la metodología INDEC N° 32, Índice de precios al consumidor (IPC). Base diciembre 2016=100, a través del siguiente enlace:
https://www.indec.gob.ar/ftp/cuadros/economia/metodologia_ipc_nacional_2019.pdf

### Ejemplos de uso para esta tabla

- **Obtener todo (paginado):**
  `GET /ipc_nacional?order=clasificador,nivel,codigo,descripcion,periodo,anio,mes,indicador,tipo_de_indicador,tipo_de_indicador_descripcion,region,unidad_de_medida&limit=1000&offset=0`
- **Buscar texto en clasificador (contiene 'valor')
Params: clasificador, nivel, codigo, descripcion, periodo, anio, mes, indicador, tipo_de_indicador, tipo_de_indicador_descripcion, region, unidad_de_medida, valor, observaciones

## /redeterminacion_precios_contratos_obras_publicas
Tag: ['Dirección de Índices de Precios de la Producción']
Aperturas del índice del costo de la construcción (ICC) y del índice de precios internos básicos al por mayor (IPIB) utilizadas para la redeterminación periódica de precios de contratos de obra pública, según el Decreto 1295/2002.
También incluye indicadores requeridos por el Decreto 634/2003, relativo a las Ampliaciones de Transporte de Energía Eléctrica en Alta Tensión y por Distribución Troncal.
Este endpoint contiene información desde diciembre de 2015.
Para más información, se puede consultar la información disponible en el sitio web del INDEC :https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-112

### Ejemplos de uso para esta tabla

- **Obtener todo (paginado):**
  `GET /redeterminac
Params: indicador, operativo, inciso, descripcion_inciso, codigo_apertura, codigo_CPC_1, codigo_CIUU_3, clasificador, nivel, descripcion, origen, periodo, anio, mes, tipo_de_indicador, tipo_de_indicador_descripcion, region, unidad_de_medida, valor, observaciones

## /sipm_precios_mayoristas
Tag: ['Dirección de Índices de Precios de la Producción']
El Sistema de índices de precios mayoristas (SIPM) está compuesto por el índice de precios internos al por mayor (IPIM), el índice de precios internos básicos al por mayor (IPIB) y el índice de precios básicos del productor (IPP). Este endpoint contiene información desde diciembre de 2015.
Para más información, se puede consultar la metodología INDEC N° 8, Sistema de Índices de Precios Mayoristas, base 1993, a través del siguiente enlace: https://www.indec.gob.ar/ftp/cuadros/economia/metodologia1_8_sipm.pdf

### Ejemplos de uso para esta tabla

- **Obtener todo (paginado):**
  `GET /sipm_precios_mayoristas?order=operativo,indicador,clasificador,nivel,codigo_apertura,descripcion,periodo,anio,
Params: operativo, indicador, clasificador, nivel, codigo_apertura, descripcion, periodo, anio, mes, tipo_de_indicador, tipo_de_indicador_descripcion, region, unidad_de_medida, valor, observaciones

## /indice_salarios
Tag: ['Dirección de Índices de Precios de la Producción']
El índice de salarios estima la evolución de los salarios pagados en la economía aislando el indicador de variaciones relacionadas con conceptos tales como la cantidad de horas trabajadas, descuentos por ausentismo, premios por productividad y todo otro concepto asociado al desempeño o a las características de los individuos concretos.
 
La serie muestra la evolución de los salarios pagados en los sectores privado registrado y público desde noviembre de 2015. A partir de octubre de 2016 se incorporó la serie del sector privado no registrado y el cálculo del índice de salarios total, que resulta de la agregación de los índices de salarios de los componentes mencionados.
 
Para más información
Params: clasificador, nivel, codigo, descripcion, periodo, anio, mes, indicador, tipo_de_indicador, tipo_de_indicador_descripcion, unidad_de_medida, valor, observaciones

## /icc_precios_construccion
Tag: ['Dirección de Índices de Precios de la Producción']
Índice del costo de la construcción (ICC) en el Gran Buenos Aires, base 1993. 
Este endpoint contiene información desde noviembre de 2015.
Para más información, se puede consultar la metodología INDEC N°  9, Índice del Costo de la Construcción en el Gran Buenos Aires, base 1993, a través del siguiente enlace: https://www.indec.gob.ar/ftp/cuadros/economia/metodologia_icc.pdf 

### Ejemplos de uso para esta tabla

- **Obtener todo (paginado):**
  `GET /icc_precios_construccion?order=indicador,codigo_apertura,codigo_CPC_1,clasificador,nivel,descripcion,periodo,anio,mes,tipo_de_indicador,tipo_de_indicador_descripcion,region,unidad_de_medida&limit=1000&offset=0`
- **Buscar texto en indicador (con
Params: indicador, codigo_apertura, codigo_CPC_1, clasificador, nivel, descripcion, periodo, anio, mes, tipo_de_indicador, tipo_de_indicador_descripcion, region, unidad_de_medida, valor, observaciones

## /estimador-mensual-de-actividad-economica-nivel-general
Tag: ['Dirección Nacional de Cuentas Nacionales']
Estimador mensual de actividad económica (EMAE), nivel general, base 2004=100. Incluye la serie original, desestacionalizada y tendencia-ciclo, expresadas como números índice y variaciones porcentuales.

Este endpoint contiene información desde enero de 2004.

Para más información, se puede consultar la metodología INDEC N° 20, Estimador Mensual de Actividad Económica (EMAE), Base año 2004, a través del siguiente enlace: https://www.indec.gob.ar/ftp/cuadros/economia/metodologia_emae_ago_16.pdf


### Ejemplos de uso para esta tabla

- **Obtener todo (paginado):**
  `GET /estimador-mensual-de-actividad-economica-nivel-general?order=tipo_de_indicador_descripcion,anio,mes,periodo,tipo_de_indicad
Params: tipo_de_indicador_descripcion, anio, mes, periodo, tipo_de_indicador, valor, observaciones

## /estimador-mensual-de-actividad-economica-sectores
Tag: ['Dirección Nacional de Cuentas Nacionales']
Estimador mensual de actividad económica (EMAE) por sector de actividad económica, base 2004=100 (serie original). Incluye números índice y variaciones porcentuales interanuales para cada sector desde enero de 2004.

Para más información, se puede consultar la metodología INDEC N° 20, Estimador Mensual de Actividad Económica (EMAE), Base año 2004, a través del siguiente enlace: https://www.indec.gob.ar/ftp/cuadros/economia/metodologia_emae_ago_16.pdf

### Ejemplos de uso para esta tabla

- **Obtener todo (paginado):**
  `GET /estimador-mensual-de-actividad-economica-sectores?order=anio,mes,codigo,descripcion,periodo,tipo_de_indicador&limit=1000&offset=0`
- **Filtrar por anio mayor a 100:**
 
Params: anio, mes, codigo, descripcion, periodo, tipo_de_indicador, valor, observaciones

## /pobreza_eph
Tag: ['Dirección Nacional de Estadísticas de Condiciones de Vida']
Incidencia de la pobreza y la indigencia en hogares y personas a partir de la Encuesta Permanente de Hogares (EPH) para el total de 31 aglomerados urbanos. La información se presenta con frecuencia semestral desde el segundo semestre de 2016.

Para más información, se puede consultar la metodología INDEC N° 22, la medición de la pobreza y la indigencia en la Argentina, a través del siguiente enlace: https://www.indec.gob.ar/ftp/cuadros/sociedad/metodologia_eph_continua.pdf . Y se puede acceder a los informes técnicos y datos complementarios en: https://www.indec.gob.ar/indec/web/Nivel4-Tema-4-31-58


### Ejemplos de uso para esta tabla

- **Obtener todo (paginado):**
  `GET /pobreza_eph?orde
Params: area_geografica_nom, area_geografica_cod, periodo, anio, semestre, tasa_pobreza_hogares, tasa_pobreza_personas, tasa_indigencia_hogares, tasa_indigencia_personas, observaciones

## /mercado_trabajo_eph
Tag: ['Dirección Nacional de Estadísticas de Condiciones de Vida']
Principales tasas del mercado de trabajo estimadas a partir de la Encuesta Permanente de Hogares (EPH), correspondientes al total de 31 aglomerados urbanos. Incluye las tasas de actividad, empleo, empleo formal e informal, desocupación, ocupación demandante de empleo y subocupación. La información se presenta con frecuencia trimestral desde el segundo trimestre de 2016.
Para más información, se puede consultar la metodología INDEC de la EPH a través del siguiente enlace: https://www.indec.gob.ar/ftp/cuadros/sociedad/metodologia_eph_continua.pdf
Y acceder a informes técnicos y datos complementarios en: https://www.indec.gob.ar/indec/web/Nivel4-Tema-4-31-58 


### Ejemplos de uso para esta tab
Params: area_geografica_nom, area_geografica_cod, periodo, anio, trimestre, tasa_de_actividad, tasa_de_empleo, tasa_de_empleo_formal, tasa_de_empleo_informal, tasa_de_desocupacion, tasa_de_ocupacion_demandante, tasa_de_subocupacion, tasa_de_subocupacion_demandante, tasa_de_subocupacion_no_demandante, observaciones

## /canasta-crianza
Tag: ['Dirección Nacional de Estadísticas de Condiciones de Vida']
Valorización mensual de la canasta de crianza de la primera infancia, la niñez y la adolescencia. Está conformada por el costo de los bienes y servicios, y la valorización del tiempo de cuidado. La estimación se realiza para cuatro tramos de edad: menores de 1 año, de 1 a 3 años, de 4 a 5 años y de 6 a 12 años. 

Gran Buenos Aires.

Este endpoint contiene información desde mayo de 2023. 

Para más información sobre la canasta de crianza, se puede consultar el siguiente enlace: https://www.indec.gob.ar/indec/web/Nivel4-Tema-4-43-173


### Ejemplos de uso para esta tabla

- **Obtener todo (paginado):**
  `GET /canasta-crianza?order=Periodo&limit=1000&offset=0`
- **Filtrar por anio mayor a 100:
Params: anio, Mes, Periodo, bys_men1, cuid_men1, tot_men1, bys_1a3, cuid_1a3, tot_1a3, bys_4a5, cuid_4a5, tot_4a5, bys_6a12, cuid_6a12, tot_6a12

## /comercio_exterior_nomenclaturas
Tag: ['Dirección Nacional de Estadísticas del Sector Externo y Cuentas Internacionales']
Diccionario de códigos y nomenclaturas utilizados en los servicios de datos de comercio exterior de la Dirección Nacional de Estadísticas del Sector Externo y Cuentas Internacionales.
Incluye los códigos de país, grandes rubros y subrubros de las exportaciones, y los usos económicos y grandes categorías económicas de las importaciones.


### Ejemplos de uso para esta tabla

- **Obtener todo (paginado):**
  `GET /comercio_exterior_nomenclaturas?order=nombre_columna,codigo&limit=1000&offset=0`
- **Buscar texto en nombre_columna (contiene 'valor'):**
                      `GET /comercio_exterior_nomenclaturas?nombre_columna=ilike.*valor*`
- **Buscar texto en codigo (contiene 'valor'):**
       
Params: nombre_columna, codigo, codigo_descripcion

## /comercio_exterior_exportacion_bienes
Tag: ['Dirección Nacional de Estadísticas del Sector Externo y Cuentas Internacionales']
Exportaciones argentinas de bienes por grandes rubros, subrubros y país de destino desde enero de 1986. Incluye el valor FOB expresado en dólares estadounidenses y el peso neto de las mercaderías expresado en kilogramos. 
La información se presenta con frecuencia mensual. Se aplican criterios de supresión para resguardar el secreto estadístico y la confidencialidad de la información aduanera. El signo convencional “s” indica que se registraron operaciones, pero el número de operadores fue insuficiente para publicar el valor.

Para conocer los códigos de país, rubro y subrubro, se encuentra disponible el servicio de datos llamado “Códigos y nomencladores de comercio exterior” (https://api.ind
Params: Anio, Mes, Periodo, rubro_cod, subrubro_cod, pais_cod, valor_FOB, Peso_Neto

## /comercio_exterior_importacion_bienes
Tag: ['Dirección Nacional de Estadísticas del Sector Externo y Cuentas Internacionales']
Importaciones argentinas de bienes por uso económico, grandes categorías económica y país de origen. Incluye el valor CIF expresado en dólares estadounidenses y el peso neto de las mercaderías expresado en kilogramos. La información se presenta con frecuencia mensual. 

Este endpoint contiene información desde enero de 1986. 

Para conocer los códigos de país, uso económico y gran categoría económica, se encuentra disponible el servicio de datos llamado “Códigos y nomencladores de comercio exterior” (https://api.indec.gob.ar/v1/comercio_exterior_nomenclaturas).

Para más información, se puede consultar la metodología INDEC N° 26, Metodología de comercio exterior, a través del siguiente enlac
Params: Anio, Mes, Periodo, uso_economico_cod, gce_cod, pais_cod, valor_CIF, peso_neto
