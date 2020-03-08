const MongooseRepository = require('./mongooseRepository');
const MongooseQueryUtils = require('../utils/mongooseQueryUtils');
const AuditLogRepository = require('./auditLogRepository');
const Epic = require('../models/epic');

/**
 * Handles database operations for the Epic.
 * See https://mongoosejs.com/docs/index.html to learn how to customize it.
 */
module.exports = class EpicRepository {
  /**
   * Creates the Epic.
   *
   * @param {Object} data
   * @param {Object} [options]
   */
  static async create(data, options) {
    if (MongooseRepository.getSession(options)) {
      await Epic.createCollection();
    }

    const currentUser = MongooseRepository.getCurrentUser(
      options,
    );

    const [record] = await Epic.create(
      [
        {
          ...data,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        },
      ],
      MongooseRepository.getSessionOptionsIfExists(options),
    );

    return this.findById(record.id, options);
  }

    /**
   * Deletes the Epic.
   *
   * @param {string} id
   * @param {Object} [options]
   */

  static async destroy(id, options) {
    await MongooseRepository.wrapWithSessionIfExists(
      Epic.deleteOne({ _id: id }),
      options,
    );

    await this._createAuditLog(
      AuditLogRepository.DELETE,
      id,
      null,
      options,
    );
  }


  /**
   * Counts the number of Patients based on the filter.
   *
   * @param {Object} filter
   * @param {Object} [options]
   */
  static async count(filter, options) {
    return MongooseRepository.wrapWithSessionIfExists(
      Epic.countDocuments(filter),
      options,
    );
  }

  /**
   * Finds the Patient and its relations.
   *
   * @param {string} id
   * @param {Object} [options]
   */
  static async findById(id, options) {
    return MongooseRepository.wrapWithSessionIfExists(
      Epic.findById(id)
      .populate('assignCase'),
      options,
    );
  }

  /**
   * Finds the Patients based on the query.
   * See https://mongoosejs.com/docs/queries.html to learn how
   * to customize the queries.
   *
   * @param {Object} query
   * @param {Object} query.filter
   * @param {number} query.limit
   * @param  {number} query.offset
   * @param  {string} query.orderBy
   *
   * @returns {Promise<Object>} response - Object containing the rows and the count.
   */
  static async findAndCountAll(
    { filter, limit, offset, orderBy } = {
      filter: null,
      limit: 0,
      offset: 0,
      orderBy: null,
    },
    options,
  ) {
    let criteria = {};

    if (filter) {
      if (filter.id) {
        criteria = {
          ...criteria,
          ['_id']: MongooseQueryUtils.uuid(filter.id),
        };
      }

      if (filter.name) {
        criteria = {
          ...criteria,
          name: {
            $regex: MongooseQueryUtils.escapeRegExp(
              filter.name,
            ),
            $options: 'i',
          },
        };
      }

      if (filter.birthdateRange) {
        const [start, end] = filter.birthdateRange;

        if (start !== undefined && start !== null && start !== '') {
          criteria = {
            ...criteria,
            birthdate: {
              ...criteria.birthdate,
              $gte: start,
            },
          };
        }

        if (end !== undefined && end !== null && end !== '') {
          criteria = {
            ...criteria,
            birthdate: {
              ...criteria.birthdate,
              $lte: end,
            },
          };
        }
      }

      if (filter.gender) {
        criteria = {
          ...criteria,
          gender: filter.gender
        };
      }

      if (filter.phone) {
        criteria = {
          ...criteria,
          phone: {
            $regex: MongooseQueryUtils.escapeRegExp(
              filter.phone,
            ),
            $options: 'i',
          },
        };
      }

      if (filter.createdAtRange) {
        const [start, end] = filter.createdAtRange;

        if (start !== undefined && start !== null && start !== '') {
          criteria = {
            ...criteria,
            ['createdAt']: {
              ...criteria.createdAt,
              $gte: start,
            },
          };
        }

        if (end !== undefined && end !== null && end !== '') {
          criteria = {
            ...criteria,
            ['createdAt']: {
              ...criteria.createdAt,
              $lte: end,
            },
          };
        }
      }
    }

    const sort = MongooseQueryUtils.sort(
      orderBy || 'createdAt_DESC',
    );

    const skip = Number(offset || 0) || undefined;
    const limitEscaped = Number(limit || 0) || undefined;

    const rows = await Epic.find(criteria)
      .skip(skip)
      .limit(limitEscaped)
      .sort(sort)
      .populate('assignCase');

    const count = await Epic.countDocuments(criteria);

    return { rows, count };
  }

  /**
   * Lists the Patients to populate the autocomplete.
   * See https://mongoosejs.com/docs/queries.html to learn how to
   * customize the query.
   *
   * @param {Object} search
   * @param {number} limit
   */
  static async findAllAutocomplete(search, limit) {
    let criteria = {};

    if (search) {
      criteria = {
        $or: [
          { _id: MongooseQueryUtils.uuid(search) },
          {
            name: {
              $regex: MongooseQueryUtils.escapeRegExp(search),
              $options: 'i',
            }
          },
        ],
      };
    }

    const sort = MongooseQueryUtils.sort('name_ASC');
    const limitEscaped = Number(limit || 0) || undefined;

    const records = await Epic.find(criteria)
      .limit(limitEscaped)
      .sort(sort);

    return records.map((record) => ({
      id: record.id,
      label: record['name'],
    }));
  }

  /**
   * Creates an audit log of the operation.
   *
   * @param {string} action - The action [create, update or delete].
   * @param {object} id - The record id
   * @param {object} data - The new data passed on the request
   * @param {object} options
   */
  static async _createAuditLog(action, id, data, options) {
    await AuditLogRepository.log(
      {
        entityName: Epic.modelName,
        entityId: id,
        action,
        values: data,
      },
      options,
    );
  }
}